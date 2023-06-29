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
            let vitality = widgetUtils.widgetGetOne('活力', 3000);
            if(vitality) {
                sleep(1000);
            }
        }
    }

    this.doSign = function () {
        FloatyInstance.setFloatyText('点击按钮观看视频');

        //看视频1-8
        for (let index = 1; index < 11; index++) {
            let caption = "第" + parseInt(index) +"个"   
            var meButton = undefined
            if(index>8){
                meButton = text("看视频").findOnce();
            }else{
                meButton = textMatches("看第\\d+个视频").findOnce();
                if (meButton == undefined){
                    continue
                }
                caption = meButton.text()        
            }
            FloatyInstance.setFloatyText("看视频" + caption)
            if (meButton == undefined){
                FloatyInstance.setFloatyText("没有找到:" + caption)
                continue
            }    
            meButton.click()
            FloatyInstance.setFloatyText("看视频等待20s" + caption)
            sleep(20000)
            this.close()  
            sleep(2000)
            FloatyInstance.setFloatyText("查找开心收下" + caption)
            var meButton =text("开心收下").findOnce()
            if (meButton != undefined){
                meButton = meButton.parent();
                meButton.click()
            }               
            FloatyInstance.setFloatyText("看视频结束: " + caption)
            sleep(2000)
        }
    }

    this.close = function () {
        // back() 失效 原因未知
        var meButton =className("android.widget.Image").text("cross").findOnce()
        if (meButton == undefined){
            meButton = className("android.widget.Image").text("此图片未加标签。打开右上角的“更多选项”菜单即可获取图片说明。").findOnce()
        }    
        if (meButton != undefined){
            meButton = meButton.parent();
            toastLog("找到了关闭按钮")
            meButton.click()
        }
    }
}

SignRunner.prototype = Object.create(BaseSignRunner.prototype)
SignRunner.prototype.constructor = SignRunner
module.exports = new SignRunner()