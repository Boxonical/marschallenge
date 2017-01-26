var restify = require('restify');
var botbuilder = require('botbuilder');
var rp = require('request-promise');

var BING_NEWS_KEY = "c71e8b850634485294087db8a79adfb3";
var COMPUTER_VISION_KEY = "41ab690e48e344e299065d5aa6357e06";

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () { console.log('%s listening to %s', server.name, server.url) });

var connector = new botbuilder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

var bot = new botbuilder.UniversalBot(connector);
server.post('api/messages', connector.listen());

var luisrecognition = new botbuilder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/cf7b01dd-64e0-46be-a1b2-49e85c53479d?subscription-key=dca5c1d871e243ca887a7080419b4750&verbose=true')
var intentdialog = new botbuilder.IntentDialog({ recognizers: [luisrecognition] });

bot.dialog('/', intentdialog);

intentdialog.matches(/\b(hi|hello|hey|howdy)\b/i, '/sayhi').matches('GetNews', '/topNews').matches('analyseImage', '/analyseImage').onDefault(botbuilder.DialogAction.send("Sorry, I didn't understand what you said."));

bot.dialog('/sayhi', function (session) {
    session.endDialog("Hello there!");
})

bot.dialog('/topNews', [function (session) { botbuilder.Prompts.choice(session, "Which category would you like?", "Technology|Science|Sports|Business|Entertainment|Politics|Health|World|(quit)"); },
function (session, results) {
    if (results.response && results.response.entity !== '(quit)') {
        session.sendTyping();
        var url = "https://api.cognitive.microsoft.com/bing/v5.0/news/?"
            + "category=" + results.response.entity + "&count=10&mkt=en-US&originalImg=true";
        var options = {
            uri: url,
            headers: {
                'Ocp-Apim-Subscription-Key': BING_NEWS_KEY
            },
            json: true
        };
        rp(options).then(function (body) {
            sendTopNews(session, results, body);
        }).catch(function (err) {
            console.log(err.message);
        }).finally(function () {
            session.endDialog("Url built");
        })
    }
    else {
        session.endDialog("Ok.. Mission Aborted");
    }
}]);

bot.dialog('/analyseImage', [function (session) {
    botbuilder.Prompts.text(session, "Send me an image link of it please.");
}, function (session, results) {
    if (results.response != null) {
        session.sendTyping();
        var url = 'https://westus.api.cognitive.microsoft.com/vision/v1.0/describe?maxCandidates=100';
        var options = {
            method: 'post',
            uri: url,
            headers: {
                'Ocp-Apim-Subscription-Key': COMPUTER_VISION_KEY,
                'Content-Type': "application/json"
            },
            body: {
                url: results.response
            },
            json: true
        };
        rp(options).then(function (body) {
            session.send("I think it\'s " + body);
        }).catch(function (err) {
            console.log(err.message);
        }).finally(function () {
            session.endDialog("Url built");
        })
    }
    else {
        session.endDialog("Ok.. Mission Aborted");
    }
}]);

function sendTopNews(session, results, body) {
    session.send("Top news in " + results.response.entity + ': ');
    session.sendTyping();
    var allArticles = body.value;
    var cards = [];
    for (var i = 0; i < 10; i++) {
        var article = allArticles[i];
        cards.push(new botbuilder.HeroCard(session).title(article.name).subtitle(article.datepublished).images([botbuilder.CardImage.create(session, article.image.contentUrl)]).buttons([botbuilder.CardAction.openUrl(session, article.url, "Full Article")]));}

    var msg = new botbuilder.Message(session).textFormat(botbuilder.TextFormat.xml).attachmentLayout(botbuilder.AttachmentLayout.carousel).attachments(cards);
    session.send(msg);
}
