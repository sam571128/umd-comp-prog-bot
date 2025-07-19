// discord-bot/commands/daily.js

const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');

const { getProblem, getUserSubmission } = require('../services/codeforces.js');
const { saveData, getData, removeData } = require('../services/database.js');
const cron = require('node-cron');
require('dotenv').config();

const easy_hist_key = 'EASY_DLB_HIST', 
      medium_hist_key = 'MED_DLB_HIST', 
      hard_hist_key = 'HARD_DLB_HIST',
      all_hist_key = 'ALL_DLB_HIST';

async function generateDailyProblems() {
    const today = new Date().toLocaleDateString();

    // Check if we already have problems for today
    const dailyProblems = await getData(`daily_problems_${today}`);
    console.log(dailyProblems);
    if (dailyProblems) {
        return dailyProblems;
    }

    // If no problems exist for today, fetch new ones
    const tags = [];
    getProblem(tags).then(async body => {
        const problems = body.result.problems;

        if (!problems.length) {
            console.error('No problems found.');
            return;
        }
        
        // TODO: Refactor from here down to reuse code
        // Filter problems with valid ratings and non-special tags
        const filteredProblems = problems.filter(problem => (
            problem.rating != null &&
            !problem.tags.includes('*special') &&
            problem.tags.length > 0
        ));

        const easyProblems = filteredProblems.filter(problem => (
            problem.rating <= 1400
        ));

        const mediumProblems = filteredProblems.filter(problem => (
            problem.rating > 1400 &&
            problem.rating <= 2100
        ));

        const hardProblems = filteredProblems.filter(problem => (
            problem.rating > 2100
        ));

        if (!filteredProblems.length) {
            console.error('No suitable problems found after filtering.');
            return;
        }

        // Select a random problem from the filtered list
        const easyListIndex = Math.floor(Math.random() * easyProblems.length);
        const easyProblem = easyProblems[easyListIndex];
        const { name: easyName, contestId: easyContestId, index: easyIndex, tags: easyProblemTags, rating: easyRating } = easyProblem;

        const mediumListIndex = Math.floor(Math.random() * mediumProblems.length);
        const mediumProblem = mediumProblems[mediumListIndex];
        const { name: mediumName, contestId: mediumContestId, index: mediumIndex, tags: mediumProblemTags, rating: mediumRating } = mediumProblem;

        const hardListIndex = Math.floor(Math.random() * hardProblems.length);
        const hardProblem = hardProblems[hardListIndex];
        const { name: hardName, contestId: hardContestId, index: hardIndex, tags: hardProblemTags, rating: hardRating } = hardProblem;

        // Store only the essential problem data
        const problemData = {
            easy: {
                name: easyName,
                contestId: easyContestId,
                index: easyIndex,
                tags: easyProblemTags,
                rating: easyRating
            },
            medium: {
                name: mediumName,
                contestId: mediumContestId,
                index: mediumIndex,
                tags: mediumProblemTags,
                rating: mediumRating
            },
            hard: {
                name: hardName,
                contestId: hardContestId,
                index: hardIndex,
                tags: hardProblemTags,
                rating: hardRating
            }
        };

        // Save the problem data
        await saveData(`daily_problems_${today}`, problemData);

        // Update problem lists for leaderboard
        const easy_list = await getData(easy_hist_key);
        saveData(easy_hist_key, [...easy_list, problemData.easy])
        const medium_list = await getData(medium_hist_key);
        saveData(medium_hist_key, [...medium_list, problemData.medium])
        const hard_list = await getData(hard_hist_key);
        saveData(hard_hist_key, [...hard_list, problemData.hard])
        const all_list = await getData(all_hist_key);
        saveData(all_hist_key, [...all_list, problemData.easy, problemData.medium, problemData.hard])

        return problemData;
    }).catch(error => {
        console.error('Error fetching creating daily problem:', error);
    });
}


async function makeProblemEmbed(data, color, title_prefix) {
    const today = new Date().toLocaleDateString();
    const problemEmbed = new EmbedBuilder()
        .setColor(color)
        .setThumbnail('https://sta.codeforces.com/s/76530/images/codeforces-telegram-square.png')
        .setTitle(`${title_prefix}: ${data.name}`)
        .addFields(
            { name: 'From', value: `${data.contestId}${data.index}` },
            { name: 'Tags', value: `||${data.tags.join(', ')}||` },
            { name: 'Difficulty', value: `||${data.rating}||` },
        )
        .setURL(`http://codeforces.com/contest/${data.contestId}/problem/${data.index}`)
        .setFooter({ text: `${title_prefix} | ${today}` });

    return problemEmbed
}


async function sendDailyProblemMessage(dailyProblems, channel) {
    if (!channel) {
        console.error('Cannot send daily problem message: No channel provided.');
        return;
    }
    if (!dailyProblems) {
        console.error('Cannot send daily problem message: No Daily Problems provided.');
        return;
    }

    const today = new Date().toLocaleDateString();
    const todayDate = `Today's Date: ${today}`;

    // If we have problems, create new embeds from the stored data
    const { easy, medium, hard } = dailyProblems;
        
    const easyProblemEmbed = await makeProblemEmbed(easy, 0x00FF55, "Easy Problem");
    const mediumProblemEmbed = await makeProblemEmbed(medium, 0xFFDD00, "Medium Problem");
    const hardProblemEmbed = await makeProblemEmbed(hard, 0xFF0033, "Hard Problem");

    channel.send(todayDate);
    channel.send({ embeds: [easyProblemEmbed, mediumProblemEmbed, hardProblemEmbed] });
}


async function getSubmissions(handle) {
    try {
        const response = await getUserSubmission(handle);
        if (response.status === 'OK') {
            return response.result;
        }
        throw new Error('Failed to fetch submissions');
    } catch (error) {
        console.error('Error fetching submissions:', error);
        throw error;
    }
}


async function getDailyLeaderboard(problems_db_key) {
    let problems = await getData(problems_db_key);
    if (!Array.isArray(problems)) problems = [];
    const prob_set = new Set();
    for (const problem of problems) {
        const prob_key = problem.contestId + problem.index;
        prob_set.add(prob_key);
    }
    let users = await getData('DAILY_LB_USERS');
    if (!Array.isArray(users)) users = [];

    const userPromises = users.map(async (user) => {
        try {
            const handle = await getData(user);
            const submissions = await getSubmissions(handle);
            let count = 0;
            const solved = new Set();
            for (const sub of submissions) {
                if (sub.verdict != 'OK') continue;
                const contestId = sub.problem.contestId;
                const index = sub.problem.index;
                const prob_key = contestId + index;
                if (prob_set.has(prob_key) && !solved.has(prob_key)) {
                    solved.add(prob_key);
                    count++;
                }
            }
            return [count, user];
        } catch (error) {
            console.error(`Error processing user ${user}:`, error);
            return [0, user];
        }
    });

    const data = await Promise.all(userPromises);

    const top_5 = [];
    data.sort((a, b) => b[0] - a[0]);
    let prev = -1;
    for (const [count, user] of data) {
        const username = await getData('DLBU_UNAME_' + user)
        if (count == prev) {
            top_5.at(-1).name += ' & ' + username;
            continue;
        }
        if (top_5.length >= 5) break;
        const lb_obj = {name: username, score: count};
        top_5.push(lb_obj);
        prev = count;
    }

    return top_5;
}

async function makeLeaderboardEmbed(db_key, color, lb_name) {
    const top_5 = await getDailyLeaderboard(db_key);
    let desc = "";
    for (const entry of top_5) {
        desc += `${entry.score}: ${entry.name}\n`;
    }
    if (desc.trim().length === 0) {
        desc = "No one on the leaderboard yet!";
    }
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${lb_name} Leaderboard`)
        .setDescription(desc);
    return embed;
}

async function sendDailyLeaderboardMessage(channel) {
    if (!channel) {
        console.error('Cannot send daily problem leaderboard message: No channel provided.');
        return;
    }

    const easyLbEmbed = await makeLeaderboardEmbed(easy_hist_key, 0x00FF55, 'Easy Problem');
    const mediumLbEmbed = await makeLeaderboardEmbed(medium_hist_key, 0xFFDD00, 'Medium Problem');
    const hardLbEmbed = await makeLeaderboardEmbed(hard_hist_key, 0xFF0033, 'Hard Problem');
    const allLbEmbed = await makeLeaderboardEmbed(all_hist_key, 0xFFFFFF, 'Overall');

    channel.send({ embeds: [easyLbEmbed, mediumLbEmbed, hardLbEmbed, allLbEmbed] });
}


// Function to send daily problems. If 'message' is provided, it sends to that channel (command triggered). Otherwise, it sends to the default daily channel (cron trigger).
async function sendDailyProblems(client, message) {

    const channel = message ? message.channel : client.channels.cache.get(process.env.DAILY_CHANNEL_ID);
    const dailyProblems = await generateDailyProblems();

    if (!channel) {
        console.error('Daily channel not found. Please check DAILY_CHANNEL_ID environment variable.');
    }
    if (!dailyProblems) {
        console.error('Daily problems not found: error fetching or creating daily problems.');
    }

    // sendDailyLeaderboardMessage(channel)
    sendDailyProblemMessage(dailyProblems, channel);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Sends daily problems'),
    initialize(client) {
        // Schedule the task to run every day at 9:00 AM New York time
        cron.schedule('0 9 * * *', () => {
            sendDailyProblems(client, null);
        }, {
            timezone: "America/New_York"
        });

        console.log('Daily problem scheduler initialized (9:00 AM EST/EDT).');
    },

    async execute(interaction) {
        const message = interaction; // Preserve compatibility with existing code
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply('You do not have permission to run this command.');
        }
        sendDailyProblems(interaction.client, interaction);
    },
    sendDailyProblems,
    sendDailyLeaderboardMessage
};
