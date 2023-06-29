/**
 * 微博签到
 */
let { config } = require('../config.js')(runtime, global)
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, this)
let FloatyInstance = singletonRequire('FloatyUtil')
let widgetUtils = singletonRequire('WidgetUtils')
let automator = singletonRequire('Automator')
let commonFunctions = singletonRequire('CommonFunction')
let localOcrUtil = require('../lib/LocalOcrUtil.js')

let BaseSignRunner = require('./BaseSignRunner.js')

function SignRunner () {
    let signImg = config.weibo_config.sign_btn
    let mineBtn = config.weibo_config.mine_btn
    let mineCheckedBtn = config.weibo_config.mine_checked_btn
    let signedIcon = config.weibo_config.signed_icon
    BaseSignRunner.call(this)
    let _package_name = 'com.qidian.QDReader'

    this.exec = function () {
        // 打开APP
        this.launchApp();
        // 前往我的
        this.goMine();
        // 进行签到
        this.doSign();
        // sleep(3000)
        // !config._debugging && commonFunctions.minimize(_package_name)
    }
    this.launchApp = function () {
        launch(_package_name)
        sleep(1000)
        this.awaitAndSkip(['\\s*允许\\s*', '\\s*取消\\s*'])
        // this.closeAdDialog()
    }
    this.closeAdDialog = function () {
        FloatyInstance.setFloatyText('查找是否有关闭广告')
        let skip = this.captureAndCheckByImg('跳过');
        if (skip) {
            automator.clickCenter(skip)
        }
    }

    this.goMine = function () {
        FloatyInstance.setFloatyText('准备查找 我')
        let clickMine = null
        if (localOcrUtil.enabled) {
            FloatyInstance.setFloatyText('准备用OCR方式查找')
            sleep(1000)
            clickMine = this.captureAndCheckByOcr('^我$', '我', [config.device_width / 2, config.device_height * 0.7])
        }
        if (!clickMine) {
            clickMine = this.captureAndCheckByImg(mineBtn, '我')
            if (!clickMine) {
                clickMine = this.captureAndCheckByImg(mineCheckedBtn, '我')
            }
        }
        if (clickMine) {
            automator.clickCenter(clickMine)
            sleep(1000);
            this.goWelfare();
        } else {
            FloatyInstance.setFloatyText('未找到 我')
            if (this.restartLimit-- >= 0) {
                FloatyInstance.setFloatyText('未找到 我 准备重开应用')
                commonFunctions.killCurrentApp()
                sleep(2000)
                this.exec()
            }
        }
    }

    this.goWelfare = function () {
        FloatyInstance.setFloatyText('查找福利中心')
        let signEntry = widgetUtils.widgetGetOne('福利中心', 3000);
        if (signEntry) {
            // 找到福利中心
            automator.click(signEntry.bounds().centerX(), signEntry.bounds().centerY())
            sleep(1000);
        }
    }

    this.doSign = function () {
        FloatyInstance.setFloatyText('点击按钮观看视频');
        let doBtn = widgetUtils.widgetGetOne('看第1个视频' || '看第2个视频' || '看第3个视频' || '看第4个视频' || '看第5个视频' || '看第6个视频' || '看第7个视频' || '看第8个视频');
        if (doBtn) {
            // 观看视频
            automator.click(doBtn.bounds().centerX(), doBtn.bounds().centerY())
            sleep(1000);
            this.watchVideo();
        } else {
            // 未找到福利中心
            FloatyInstance.setFloatyText('未找到观看视频，查找是否已经全部看完');
            sleep(1000);
            let doneBtn = widgetUtils.widgetGetOne('已看完', 3000);
            if (doneBtn) {
                this.setExecuted()
            }
        }
    }

    this.watchVideo = function () {
        FloatyInstance.setFloatyText('观看视频');
        // 观看视频
        let curText = widgetUtils.widgetGetOne('已观看视频15秒', 30000);
        if(curText) {
            automator.back();
            sleep(1000);
            FloatyInstance.setFloatyText('观看视频后弹窗、我知道了');
            let knowText = widgetUtils.widgetGetOne('我知道了', 2000);
            if(knowText) {
                automator.click(knowText.bounds().centerX(), knowText.bounds().centerY());
            } else {
                automator.back();
            }
            this.doSign();
        } else {
            FloatyInstance.setFloatyText('未观看视频，返回到福利中心');
            automator.back();
            this.goWelfare();
        }
    }
}

SignRunner.prototype = Object.create(BaseSignRunner.prototype)
SignRunner.prototype.constructor = SignRunner
module.exports = new SignRunner()