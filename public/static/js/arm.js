import  Amr from './amrnb.js'
/**
 * 使用:
 *   在这个文件也要引入 AMR 就是另外一个文件
 *  import Audo from './....你的路径'
 *  const onplaying = ({current, isPlaying, duration}) => {
 *    console.log(`当前播放到第${current}s, 总长${duration}s`, 'background: red;border-radius: 5px')
 *  }
 *  cosnt audo = new Audo('你的url', onplaying);
 *
 *  audo.start()//开始播放
 *  audo.stop()//暂停
 *  audo.duration //总共音频有多少秒
 *
 * */
export default class AudoApi {
    constructor(url, onPlaying) {
        this.timer = null;
        /**
         * @desc 状态信息
         * */
        this.playAgain = {};
        this.audioContext = { isPlaying: false, current: 0, duration: 0}
        this.init(url);

        this.onPlaying = onPlaying;
    }

    init(href) {
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
            const samples = Amr.decode(array);
            if (!samples) return;
            return playPcmer(samples, beginTimestamp)
        }

        /**
         * @desc 播放 AudioContext
         * */
        const that = this;

        function playPcmer(samples, beginTimestamp) {
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
            src.start()
            /**
             * @desc
             * 音频时间长短  buffer.duration
             * */
            that.audioContext.stop = () => {
                src.stop();
            }
            that.src = src;
            return {
                duration: buffer.duration,
                // stop: src.stop,
                ctx,
                buffer,
            }
        }

        const startPlay = (beginTimestamp = 0) => {
            return fetch(href).then(res => res.blob())
                .then(myBlob => readBlob(myBlob))
                .then(data => playAmrArray(data, beginTimestamp)).then(data => {
                    this.audioContext = {...this.audioContext,...data};
                    return data;
                });
        }

        const onPlayInterval = () => {
            const duration = this.audioContext.duration||0, delay = 100;
            this.audioContext.isPlaying = true;

            clearInterval(this.timer);

            let current = 0;
            const totalTime = duration * 1000;
            this.timer = setInterval(() => {
                current += delay;
                if (current >= totalTime || !this.audioContext.isPlaying) {
                    clearInterval(this.timer);

                    if (current >= totalTime) {
                        this.audioContext.current = 0;//结尾处, 回归0
                        console.log(this.audioContext)
                    }
                    this.audioContext.isPlaying = false;
                }

                this.audioContext.current = current / 1000;
                this.onPlaying()(current / 1000, duration, this.audioContext.isPlaying);
            }, delay)
        }

        this.start = (beginingTime = this.audioContext.current) => {
            // this.currentPlayingTime = beginingTime;
            if (this.audioContext.isPlaying) {
                console.log('正在播放!')
                return;
            }
            this.audioContext.isPlaying = true;

            startPlay(beginingTime).then(data => {
                onPlayInterval(beginingTime);
            });
        }

        this.playAgain = () => {
            this.src.buffer = this.audioContext.buffer;
            this.src.connect(this.audioContext.ctx.destination);
            this.src.start()
        }

        this.stop = () => {
            this.audioContext.ctx.suspend();
            if(this.audioContext.stop){
                this.audioContext.stop()
                this.audioContext.stop = null;
            }
            // this.audioContext.stop();
            this.audioContext.stop = null;
            this.audioContext.isPlaying = false;
            //中途播放中停止, 记录播放到哪里了
        }
    }
    /**
     * 监听播放过程
     * @param current 当前播放到多少秒
     * @param duration 音频总共有多少秒 以秒为单位
     * @param isPlaying 是否在播放中
     * */
    onPlaying(current ,duration, isPlaying){
        this.onPlaying({current ,duration, isPlaying})
    }
}

