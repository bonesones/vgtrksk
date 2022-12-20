const TelegramBot = require('node-telegram-bot-api');
const token = token;
const bot = new TelegramBot(token, { polling: true });
const mysql = require('mysql2')
const axios = require('axios');

const db = mysql.createConnection({
    host: "localhost",  
    user: "root",
    database: "nodemysql",
    password: '1234'
})

let index = 0;
let isProcessed = false;
const commands = ["Просмотреть все необработанные заявки", "Найти заявку по номеру", "История заявок"]

db.connect((err) => {
    if(err){
        throw err;
    }
    console.log('telegram db success')
})

const welcomMessage = function(chatId) {
    bot.sendMessage(chatId, "Приветствую")
    bot.sendMessage(chatId, 'Бот создан для предприятия ООО "ВГТРК СК"', {
        reply_markup: {
            keyboard: [
                [
                    "Просмотреть все необработанные заявки",
                ],[
                    "Найти заявку по номеру",
                    "История заявок"
                ]
            ],
            resize_keyboard: true
        }
    })
}



const loginUser = function(chatId, username) {
    isActive = true;
    bot.sendMessage(chatId, "Введите имя пользователя");
    let login, password;

    bot.on('message', function loginCheck(msg){
        login = msg.text;
        bot.sendMessage(chatId, "Введите пароль");
        bot.off('message', loginCheck);

        bot.on("message", function passwordCheck(msg){
            password = msg.text;
            bot.off('message', passwordCheck);

            const sql = "SELECT * FROM admins WHERE username = ? AND pass = ?";

            db.query(sql, [login, password], (err, result, fields) => {
                if(err) throw err;
                
                if(result.length === 0) {
                    bot.sendMessage(chatId, "Неверные данные");
                    isActive = false;
                    return;
                }
                db.query("INSERT INTO users (userId, username) VALUES(?, ?)", [chatId, username], (err, result, fields) => {
                    if(err) throw err;
                })
                welcomMessage(chatId)
                access = true;
            })
        })
    })


}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const sql = "SELECT * FROM users WHERE userId = ?";
    db.query(sql, [chatId], (err, result, fields) => {
        if(result.length !== 0) {
            access = true;
            welcomMessage(chatId);
        } else {
            loginUser(chatId, username);
        }
    })
})


const sendLastRequest = function(chatId){
    const sql = "SELECT * FROM test2 ORDER BY id DESC LIMIT 1";
    db.query(sql, (err, [result], fields) => {
        const data = {
            id: `Заявка №<code>${result.id}</code>\n`,
            name: `Имя: ${result.name}\n`,
            phone: `Телефон: ${result.phone}\n`,
            body: `Сообщение: \n${result.body}`
        }

        bot.on('callback_query', currentCallbackQuery);

        bot.sendMessage(chatId, data.id + data.name + data.phone + (result.body ? data.body : ""), {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: "✅ Пометить обработанной",
                        callback_data: "processed " + result.id
                    }]
                ]
            }
        })
    })
}

const primary = function(query) {
    const chatId = query.message.chat.id;

    switch(query.data){
        case "check_last":
            sendLastRequest(chatId)
            bot.off("callback_query", primary)
            break;
        default:
            bot.off("callback_query", primary)
            break;
    }
}

const sendCallBackRequest = async function() {

    const response = await axios.get("http://localhost:3500/requests/status/unprocessed")
    const data = response.data;

    bot.on("callback_query", primary)

    const sql = "SELECT userId FROM users";

    db.query(sql, (err, result, fields) => {
        result.forEach( async ({ userId }) => {
            await bot.sendMessage(userId, "📩 +1 новая заявка", {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: "Просмотреть",
                            callback_data: "check_last"
                        }]
                    ]
                }
            })
            await bot.sendMessage(userId, "Всего необработанных заявок: " + data.length)
        })
    })
}

const splitArray = function(array, length) {
    let page = [];

    return array.reduce((acc, init, index, arr) => {
        page.push(init);
        if(page.length === length || index === arr.length - 1) {
            acc.push(page);
            page = [];
            return acc;
        }
        return acc;
    }, [])
}

const checkFirstPage = function(page) {
    return page === 0;
}

const checkLastPage = function(array, page) {
    return page === array.length - 1
}

const renderPage = function(array, index) {
    const prev = {
        text: "<<",
        callback_data: "prev"
    }

    const next = {
        text: ">>",
        callback_data: "next"
    }

    const currentPage = {
        text: `${index + 1}/${array.length}`,
        callback_data: "nothing"
    }

    return { 
            "inline_keyboard": [
                ...array[index],
                [
                    prev,
                    currentPage,
                    next
                ]
            ]
        }
}

const getCurrentRequest = async function(id) {
    const response = await axios.get(`http://localhost:3500/requests/${id}`);
    const data = response.data;
    return data;
}

const changeRequestStatusTo = function(status, id) {
    const sql = "UPDATE test2 SET status = ? WHERE id = ?" 

    db.query(sql,[status, id], (err, result, fields) => {
        if(err) throw err;
    })
}

const currentCallbackQuery = async function(query) {
    const chatId = query.message.chat.id;

    switch(query.data) {
        case query.data.match(/^processed \d+/)?.[0]:
            changeRequestStatusTo('processed', query.data.split(' ')[1]);

            await bot.sendMessage(chatId, "Статус заявки изменён на: 'обработана'");

            bot.off('callback_query', currentCallbackQuery);
            break;
        case "Cancel":
            let data;
            bot.off('callback_query', currentCallbackQuery)
            if(!isProcessed){
                data = await getUnprocessedRequests();
            } else {
                data = await getProcessedRequests();
            }
            await sendPage(chatId, data, index);
            break;
        default:
            break;

    }
}
const sendCurrentRequest = async function(chatId, id) {
    const request = await getCurrentRequest(id);
    const result = {
        id: `Заявка №<code>${request.id}</code>\n`,
        name: `Имя: ${request.name}\n`,
        phone: `Телефон: ${request.phone}\n`,
        body: `Сообщение: \n${request.body}`
    }

    bot.on('callback_query', currentCallbackQuery);
    
    bot.sendMessage(chatId, result.id + result.name + result.phone + (request.body ? result.body : ""), {
        parse_mode: "HTML"
    }).catch(e => console.log(e.stack))

}

const editCurrentRequest = async function(chatId, message, id) {

    const request = await getCurrentRequest(id);
    const result = {
        id: `Заявка №<code>${request.id}</code>\n`,
        name: `Имя: ${request.name}\n`,
        phone: `Телефон: ${request.phone}\n`,
        body: `Сообщение: \n${request.body}`
    }

    bot.on('callback_query', currentCallbackQuery);

    const isProcessed = request.status === "processed" ? true : false;

    if(!isProcessed) {
        bot.editMessageText(result.id + result.name + result.phone + (request.body ? result.body : ""), {
            message_id: message,
            chat_id: chatId,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: "✅ Пометить обработанной",
                        callback_data: "processed " + request.id
                    }],
                    [{
                        text: "Назад",
                        callback_data: "Cancel"
                    }]
                ]
            }
        })
    } else {
        bot.editMessageText(result.id + result.name + result.phone + (request.body ? result.body : ""), {
            message_id: message,
            chat_id: chatId,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: "Назад",
                        callback_data: "Cancel"
                    }]
                ]
            }

        })
    }
}

const callback = async function(query) {
    const chatId = query.message.chat.id;
    const message = query.message.message_id;
    const isFirstPage = checkFirstPage(index);
    let data;
    if(isProcessed) {
        data = await getProcessedRequests();
    } else {
        data = await getUnprocessedRequests();
    }

    const isLastPage = checkLastPage(data, index);

    const currenRequest = query.data.match(/\d+/)?.[0] ?? ""

    switch(query.data) {
        case "prev":
            if(isFirstPage) break;
            bot.removeListener("callback_query", callback)
                       
            await editPage(data, --index, message, chatId)
            break;
        case "next":
            if(isLastPage) break;
            bot.removeListener("callback_query", callback)

            await editPage(data, ++index, message, chatId)
            break;
        case currenRequest:
            bot.off('callback_query', callback)
            await editCurrentRequest(chatId, message, query.data)
            
            break;
        default:
            break;

    }
}

const sendPage = function(chatId, array, index) {
    if(array.length === 0) {
        bot.sendMessage(chatId, (isProcessed ? "Обработанные " : "Необработанные ") + "заявки отсутствуют")
        return;
    }
    bot.on("callback_query", callback);

    return bot.sendMessage(chatId, isProcessed ? "Обработанные заявки" : "Необработанные заявки", {
        "reply_markup": renderPage(array, index)
    })
}

const editPage = function(array, index, message, chat) {
    bot.on("callback_query", callback);

    return bot.editMessageReplyMarkup(renderPage(array, index), {
        message_id: message,
        chat_id: chat
    });
}

const getCallBackRequests = async function() {
    const response = await axios.get("http://localhost:3500/requests")
    const data = response.data;
    if(!!!data) {
        return
    }

    const result = data.map(({ id }) => {
        return [{
            "text": `Заявка №${id}`,
            "callback_data": id 
            }]
    });

    return splitArray(result, 5)
}

const askRequestId = function(chatId) {
    bot.sendMessage(chatId, "Введите номер заявки");

    bot.on('message', async function request(msg) {
        const chatId = msg.chat.id;
        
        switch(msg.text) {
            case msg.text.match(/\d+/)?.[0]:
                await sendCurrentRequest(chatId, msg.text);
                bot.removeListener('message', request)
                break;
            default:
                if(commands.includes(msg.text)) {
                    bot.removeListener('message', request);
                    break;
                }
                bot.sendMessage(chatId, "Неверно введен номер заявки")
                break;
        }
    });
}

const getUnprocessedRequests = async function() {
    const response = await axios.get('http://localhost:3500/requests/status/unprocessed')
    const data = response.data;
    if(!!!data) {
        return
    }

    const result = data.map(({ id }) => {
        return [{
            "text": `Заявка №${id}`,
            "callback_data": id 
            }]
    });

    return splitArray(result, 5);
}

const getProcessedRequests = async function() {
    const response = await axios.get('http://localhost:3500/requests/status/processed')
    const data = response.data;
    if(!!!data) {
        return
    }

    const result = data.map(({ id }) => {
        return [{
            "text": `Заявка №${id}`,
            "callback_data": id 
            }]
    });

    return splitArray(result, 5);

}

const mainCommandsHandler = async function(msg) {
    const chatId = msg.chat.id;
    let data;

    switch(msg.text) {
        case "Просмотреть все необработанные заявки":
            isProcessed = false;
            bot.removeAllListeners('callback_query')
            data = await getUnprocessedRequests();
            await sendPage(chatId, data, index);
            break;
        case "Найти заявку по номеру":
            askRequestId(chatId);
            break;
        case "История заявок":
            isProcessed = true;
            bot.removeAllListeners('callback_query')
            data = await getProcessedRequests();
            await sendPage(chatId, data, index)
    }
}

bot.on("message", async msg => {
    const chatId = msg.chat.id;
    const sql = "SELECT * FROM users WHERE userId = ?";
    db.query(sql, [chatId], (err, result, fields) => {
        if(result.length !== 0) {
            mainCommandsHandler(msg)
        } else {
            bot.sendMessage(chatId, "У вас нет доста к боту")
        }
    });
})

bot.on('polling_error', (err) => {
    console.log(err.message)
})

module.exports = { sendCallBackRequest }