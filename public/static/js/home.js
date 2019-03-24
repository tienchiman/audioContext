const Axios = window.axios, Amr = window.AMR, $ = window.jQuery;

let count = 0;
const log = data => {
    if(count >= 8){
       count = 0;
       console.clear()
    }
    console.log(`%c[${count}]${JSON.stringify(data, null, 2)}`, `background: #ffcece;border-radius: 5px;min-width: 100px;color: #113f67;line-height: 30px;padding: 0 20px;`)
    count += 1;
}

/**
 * 双向绑定
 * */
class BindModel {
    constructor(templateId) {
        this.container = $(`#${templateId}`);
    }

    init(list) {
        const templatetring = this.container.html().replace(/\n/g, '');
        // const htmls = Array.from({length}, (c,i) => templatetring.replace(/\$index/g, i));
        const htmls = list.map((url, index) => {
            const name = url.split(/\//).slice(-1)[0].split('.')[0];
            return templatetring.replace(/\$index/g, index).replace(/\$url/g, url).replace(/\$name/g, name || '/');
        });
        this.container.html(htmls.join(''));

    }

    /**
     * 改变某个属性值
     * */
    changeSoneItem(index, data) {
        const attrReg = /\[(.*?)\]/;

        const $listItem = $(`#list-item-${index}`);
        const changItem = (key, newValue) => {
            $listItem.find(`[${key}]`).each((index, item) => {
                const $item = $(item), attrString = $item.attr(key);
                const attrParsed = attrReg.exec(attrString);
                if (attrParsed) {
                    const [name, someAttr] = attrParsed[1].split('.');
                    if (/^content$/.test(name)) {
                        $item.text(newValue)
                    } else if (/^style$/.test(name)) {
                        item[name][someAttr] = newValue
                    } else {
                        $item.attr(name, newValue);
                    }
                }
            })

        }

        Object.keys(data).forEach(key => changItem(key, data[key]))
    }

    /**
     * 绑定事件
     * */
    bindEventByLoop(loopCallback) {
        this.container.find('[click]').each((index, item) => {
            const $item = $(item);
            const parent = $item.parent();
            $item.on('click', () => {
                const {handle, index} = item.dataset;
                const status = parent.attr('status'), url = parent.attr('path');
                // 同一状态下
                if (handle === status) return;
                loopCallback && loopCallback({status, url, handle, index: Number(index)});
            });
        })
    }
}

/**
 * 介入音频api
 *
 * */

// const gAudioContext = new AudioContext()

/**
 *
 * @param  {}   [url] 音频地址
 * @parm   {} [options]  一个对象
 *
 *        options {
     *            onPlaying( current, { isPlaying, duration}){
     *
     *            }
     *        }
 *
 *  对象上包含一些东西
 *
 *
 * */
class AudoApi {
    constructor(url, onPlaying) {
        this.timer = null;

        this.isPlaying = false;
        this.duration = 0;
        this.context = null;

        this.init(url, onPlaying);
    }

    init(href, onPlaying) {

        const onPlayInterval = (duration) => {
            const delay = 80;
            clearInterval(this.timer);
            const start = +new Date();
            this.timer = setInterval(() => {
               const current = this.context.currentTime, playedTime = (+new Date() - start) / 1000;

               const hasEnd = duration - current <= 0 || playedTime >= duration;//播放完必了
               if(hasEnd || !this.isPlaying){
                   this.isPlaying = false;
                   clearInterval(this.timer);
                   //当播放完了之后, 再次init   suspended
                   if(hasEnd){
                       this.context.close();
                   }
               }


                onPlaying({current, duration, isPlaying: this.isPlaying})
                log(this.context.state);//suspended
            }, delay)
        }

        const initEnv = (callback) => {
            return initAudio(href, Amr).then(envim => {
                if(!envim) return;
                const env = envim.ctx;
                this.duration  = envim.duration;
                this.context   =  env;

                // this.start = () => {
                //     this.isPlaying = true;
                //     env.resume();
                //     onPlayInterval(envim.duration);
                //     log(this.context.state);
                // };
                callback && callback(envim)
                this.stop = () => {
                    this.isPlaying = false;
                    env.suspend();
                    log(this.context.state);
                }
            });
        }

        this.start = () => {
            /**
             * 当context为null 说明没初始化过, 当
             *
             * */
            if(!this.context || /^closed$/.test(this.context)){
                initEnv(envim => {
                    this.isPlaying = true;
                    envim.ctx.resume();
                    onPlayInterval(envim.duration);
                    log(envim.ctx.state);
                })
                return;
            }

            this.isPlaying = true;
            this.context.resume();
            onPlayInterval(this.duration);
            log(this.context.state);
        };
        return initEnv()
    }
}

/**
 * 初始化页面
 * */
class Page {
    constructor(pageId) {
        this.container = document.getElementById(pageId);

        // 将所有事件绑定到this
        const methods = this.methods();
        Object.keys(methods).forEach(key => this[key] = (...params) => methods[key].call(this, ...params));
        // 执行双向绑定

        this.ModelView = new BindModel(pageId);

        this.audoList = {};

        this.count = 0;
    }

    mounted(that) {
        that.init({timestamp: +new Date()})
    }

    setState(index, data) {
        this.ModelView.changeSoneItem(index, data);
    }

    methods() {
        return {
            getAmrs: data => Axios.post('/getAmr', data).then(({data: {data: {list}}}) => list).catch(error => console.error(error)),
            init(data) {
                this.getAmrs(data).then(list => {
                    this.list = list;
                    this.updateView(list);

                    const that = this;
                    list.forEach((url, index) => {
                        this.audoList[`${index}`] = new AudoApi(url,
                            ({current, duration, isPlaying}) => that.onSomeAudoPlaying(index, duration, current, isPlaying))

                    })
                })
            },
            updateView(list) {
                this.ModelView.init(list);
                this.ModelView.bindEventByLoop((data) => {
                    this.bindCtrlPlay(data);
                });

            },
            bindCtrlPlay({index, handle, url, status}) {
                if (handle === 'play') {
                    this.audoList[`${index}`].start();
                    this.setState(index, {state: 'play'})
                } else {
                    this.audoList[`${index}`].stop()
                    this.setState(index, {state: 'stop'})
                }
            },
            onSomeAudoPlaying(index, duration, current) {
                this.setState(index, {progress: `${current / duration * 100}%`});
            }

        }
    }
}

/**
 * 迭代页面
 * */
const page = new Page('app');
page.mounted(page);


/**
 *  @desc 得到音频对象
 *  @param  { string }  [href] 路径
 *  @param  { object }  [AmR ]
 *
 *
 *  @return {
 *    duration , 总共时长
 *    ctx, 这个对象可以调动很多方法
 *
 *  }
 * */
function initAudio(href, AmR) {
    /**
     * @desc  文档可见于
     *   https://developer.mozilla.org/zh-CN/docs/Web/API/AudioContext
     * */

    function readBlob(blob) { // File Reader 返回 buffer array
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const data = new Uint8Array(e.target.result);
                resolve(data);
            };
            reader.readAsArrayBuffer(blob);
        })
    }

    /*
    * @desc AMR 解码
    * */
    function playAmrArray(array, beginTimestamp) {
        const samples = AmR.decode(array);
        if (!samples) return;
        return playPcmer(samples, beginTimestamp)
    }

    /**
     * @desc 播放 AudioContext
     * */
    function playPcmer(samples) {
        const ctx = new AudioContext();
        const src = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, samples.length, 8000);
        if (buffer.copyToChannel) {
            buffer.copyToChannel(samples, 0, 0)
        } else {
            const channelBuffer = buffer.getChannelData(0);
            channelBuffer.set(samples);
        }
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
        //暂时停住
        ctx.suspend();
        /**
         * @desc
         * 音频时间长短  buffer.duration
         * */
        return {
            duration: buffer.duration,//时间长
            /**
             * 这几个方法都在ctx上, 不用输出了
             *
             * */
            // stop: () => ctx.suspend(),//停止
            // start: () => ctx.resume(),//播放
            // getCurrentTime: () => ctx.currentTime,//播放到哪里了
            // onstatechange: ctx.onstatechange,
            // close: () => ctx.close()
            // getState: () => ctx.state,
            ctx,
        }
    }

    return fetch(href).then(res => res.blob()).then(myBlob => readBlob(myBlob)).then(data => playAmrArray(data))
}