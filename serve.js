const express = require("express"),
    bodyParser = require('body-parser'),
    os = require('os'),
    fs = require('fs'), url = require('url');
const {join} = require('path')
/**
 * @desc 一些配置
 * */
const Config = {
    port: 3000,
    protocol: 'http:',
    host: 'localhost'
}

const app = express();
const server = require('http').createServer(app);

/**
 * @desc 设置解析json等
 * */
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());


/**
 * @desc加载静态资源
 * */
app.use(express.static('public'));
app.use('/static', express.static('public/static'));


/**
 * @desc 处理请求的路径
 * */
const parseReqUrl = url => url.split(/\//).filter(path => !!path);
/**
 * @desc 中间键值, 控制跨域 访问限制等
 *
 * */
app.use((req, res, next) => {
    // res.setHeader("Access-Control-Allow-Origin","*");
    // req.stone="too big";
    // res.end("hello");
    // res.setHeader("Set-Cookie", `Version=${+new Date()}`);
       res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

    next(); //不调用就不往下走了

    //res.end("hello")
    // res.send(202)
})

/**
 * 处理get
 * */
const pages = ['index', 'amr', 'home']
app.get('*', (req, res, next) => {
    const paths = parseReqUrl(req.url);

     const readPublicHtml = path => {
         res.setHeader('Content-Type', 'text/html;charset=utf8');
         res.sendFile(join(__dirname, `public/${path}.html`))
     }

    if (paths.length === 0) {
        return readPublicHtml('home')
    } else {
        const [ path ] = paths;
        if (paths.length === 1 && pages.includes(path)) {
            return readPublicHtml(path)
        }
    }
    res.setHeader('Content-Type', 'application/json;charset=utf8');
    res.send({message: 'plase call me 活雷锋! 哈哈哈哈 (*-*)', code: '404'});
    next();
});

/**
 * @desc 处理post
 * */
const postHandlers = {
    'getAmr': body => {
        const basePath = `${Config.protocol}//${Config.host}:${Config.port}/static/amr/`;
        const names = ['amr.amr', 'qinshi.amr','yuan.amr'];
        return {list: names.map(name => `${basePath}${name}`), body};
    }
}
//判断是注册的path
const includesInpostHandlersRegExp = new RegExp(`^(${Object.keys(postHandlers).join('|')})$`);

app.post('*', (req, res, next) => {

    const {url, body} = req;
    const paths = parseReqUrl(url);
    if(paths.length === 1 && includesInpostHandlersRegExp.test(paths[0])){
        res.send({data: postHandlers[paths[0]](body), code: 200, message: 'success'})
    }else{
        res.send({message: 'not found', code: '404'});
    }
    next();
});


/**
 * @desc
 * */
server.listen(Config.port, Config.host, e => {
    console.log('listen', `${Config.protocol}//${Config.host}:${Config.port}`)
});


/**
 * @getClientIP
 * @desc 获取用户 ip 地址
 * @param {Object} req - 请求
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || // 判断是否有反向代理 IP
        req.connection.remoteAddress || // 判断 connection 的远程 IP
        req.socket.remoteAddress || // 判断后端的 socket 的 IP
        req.connection.socket.remoteAddress;
};

/**
 * @desc 获取本机ip
 *
 * */
function getLocalIP() {
    var localhost = ''
    try {
        const network = os.networkInterfaces();

        fs.writeFileSync('./network',network, 'utf8')

        localhost = network[Object.keys(network)[0]][1].address
    } catch (e) {
        localhost = '127.0.0.1'
    }
    return localhost;
}

