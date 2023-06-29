var default_config = {
    password: '2489',
    timeout_unlock: 1000,
    timeout_findOne: 1000,
    timeout_existing: 8000,
    // 是否根据当前锁屏状态来设置屏幕亮度，当锁屏状态下启动时 设置为最低亮度，结束后设置成自动亮度
    auto_set_brightness: false,
    device_width: device.width,
    device_height: device.height,
};

var _config = default_config;
  
var _storageName = 'unify_sign';

var NORMAL_DEVICE = function (obj) {
    this.DEVICE_TYPE = {
      VIVO: 'vivo',
      COLOROS: 'coloros',
      NORMAL: 'normal',
    }
    this.storage = storages.create(_storageName)
    this.__proto__ = obj
    // 图形密码解锁
    this.unlock_pattern = function (password) {
        log('使用图形密码解锁');
        if (typeof password !== 'string') throw new Error('密码应为字符串！')
        var lockBounds = id('com.android.systemui:id/lockPatternView')
            .findOne(_config.timeout_findOne)
            .bounds();
        var boxWidth = (lockBounds.right - lockBounds.left) / 3;
        var boxHeight = (lockBounds.bottom - lockBounds.top) / 3;
        var positions = password.split('').map(p => {
            var checkVal = parseInt(p) - 1;
            return { r: parseInt(checkVal / 3), c: parseInt(checkVal % 3) }
        }).map(p => {
            return [parseInt(lockBounds.left + (0.5 + p.c) * boxWidth), parseInt(lockBounds.top + (0.5 + p.r) * boxHeight)];
        })
        gesture(220 * positions.length, positions);
        return this.check_unlock();
    }
  
    // PIN解锁
    this.unlock_pin = function (password) {
        log('使用PIN密码解锁');
        if (typeof password !== 'string') throw new Error('密码应为字符串！')
        // 模拟按键
        var button = null;
        for (var i = 0; i < password.length; i++) {
            var key_id = 'com.android.systemui:id/key' + password[i];
            if ((button = id(key_id).findOne(_config.timeout_findOne)) !== null) {
                button.click();
            }
            sleep(100);
        }
        return this.check_unlock();
    }
  
    /**
     * coloros 解锁
     * @param {string} password 
     * @returns 
     */
    this.unlock_coloros_sample = function (password) {
        log('使用coloros的PIN密码解锁')
        if (typeof password !== 'string') throw new Error('密码应为字符串！');
        // 模拟按键
        var button = null;
        var keyboardRoot = id('com.android.systemui:id/pinColorNumericKeyboard').findOne(_config.timeout_unlock);
        if (!keyboardRoot) {
            throw new Error('获取键盘控件失败');
        }
        for (var i = 0; i < password.length; i++) {
            button = keyboardRoot.child((parseInt(password[i]) + 9) % 10);
            if (button !== null) {
                button.click();
            } else {
                log(['未找到数字按钮：{} 可能无法正常解锁', password[i]]);
            }
            sleep(100);
        }
        _config.unlock_device_flag = this.DEVICE_TYPE.COLOROS;
        this.storage.put('unlock_device_flag', _config.unlock_device_flag);
        return this.check_unlock();
    }
  
    this.unlock_vivo_pin = function (password) {
        log('使用vivo的PIN密码解锁');
        if (typeof password !== 'string') throw new Error('密码应为字符串！');
        // 模拟按键
        var button = null;
        for (var i = 0; i < password.length; i++) {
            var key_id = 'com.android.systemui:id/VivoPinkey' + password[i];
            if ((button = id(key_id).findOne(_config.timeout_findOne)) !== null) {
                button.click();
            }
            sleep(100);
        }
        _config.unlock_device_flag = this.DEVICE_TYPE.VIVO;
        this.storage.put('unlock_device_flag', _config.unlock_device_flag);
        return this.check_unlock();
    }
  
    // 判断解锁方式并解锁
    this.unlock = function (password) {
        if (typeof password === 'undefined' || password === null || password.length === 0) {
            log('密码为空：' + JSON.stringify(password));
            throw new Error('密码为空！');
        }
        var unlockSuccess = false;
        // 特殊设备 记住解锁方式
        switch (_config.unlock_device_flag) {
            case this.DEVICE_TYPE.VIVO:
                unlockSuccess = this.unlock_vivo_pin(password)
            break
            case this.DEVICE_TYPE.COLOROS:
                unlockSuccess = this.unlock_coloros_sample(password)
            break
            default:
            // no operation
        }
        // 如果是vivo或者coloros直接返回成功
        if (unlockSuccess) {
            return true
        }
        // 其他设备 依次判断 pin、手势、字符串、coloros、vivo
        if (idMatches('com.android.systemui:id/(fixedP|p)inEntry').exists()) {
            return this.unlock_pin(password)
        } else if (id('com.android.systemui:id/lockPatternView').exists()) {
            return this.unlock_pattern(password)
        } else if (id('com.android.systemui:id/pinColorNumericKeyboard').exists()) {
            return this.unlock_coloros_sample(password)
        } else if (id('com.android.systemui:id/vivo_pin_keyboard').exists()) {
            return this.unlock_vivo_pin(password)
        } else {
            log('识别锁定方式失败，型号：' + device.brand + ' ' + device.product + ' ' + device.release);
            log('请运行unit/获取解锁界面控件信息.js 获取布局信息自行开发解锁代码 或者向开发者寻求帮助');
            return this.check_unlock();
        }
    }
}

function Unlocker () {
    const _km = context.getSystemService(context.KEYGUARD_SERVICE)
  
    this.relock = false
    this.reTry = 0
  
    // 设备是否锁屏
    this.is_locked = function () {
      return _km.inKeyguardRestrictedInputMode()
    }
  
    // 设备是否加密
    this.is_passwd = function () {
      return _km.isKeyguardSecure()
    }
  
    // 解锁失败
    this.failed = function () {
        back()
        this.reTry++
        if (this.reTry > 3) {
            log('解锁失败达到三次，停止运行');
            _config.resetBrightness && _config.resetBrightness();
            this.saveNeedRelock(true);
            exit();
        } else {
            var sleepMs = 5000 * this.reTry;
            log('解锁失败，' + sleepMs + 'ms之后重试');
            sleep(sleepMs);
            this.run_unlock();
        }
    }
  
    // 检测是否解锁成功
    this.check_unlock = function () {
        sleep(_config.timeout_unlock);
        if(!this.is_locked()) {
            return true;
        }
        if (textContains('重新|重试|错误').findOne(_config.timeout_existing)) {
            log('密码错误');
            return false;
        }
        return !this.is_locked();
    }
  
    // 唤醒设备
    this.wakeup = function () {
        if (this.relock && _config.auto_set_brightness && !_config.resetBrightness) {
            _config.last_brightness_mode = device.getBrightnessMode();
            _config.last_brightness = device.getBrightness();
            log(['设置显示亮度为最低，关闭自动亮度 原始模式: {} 亮度: {}', _config.last_brightness_mode, _config.last_brightness]);
            _config.resetBrightness = () => {
            log(['重置自动亮度 原始模式: {} 亮度: {}', _config.last_brightness_mode, _config.last_brightness]);
            if (!isNaN(_config.last_brightness_mode)) {
                device.setBrightnessMode(_config.last_brightness_mode);
                log('自动亮度模式调整完毕');
            }
            if (!isNaN(_config.last_brightness)) {
                device.setBrightness(_config.last_brightness);
                log('亮度值调整完毕');
            }
            _config.resetBrightness = null;
            }
            // 设置最低亮度 同时关闭自动亮度
            device.setBrightnessMode(0);
            device.setBrightness(1);
        }
        var limit = 3
        while (!device.isScreenOn() && limit-- > 0) {
            device.wakeUp();
            sleep(_config.timeout_unlock);
        }
        if (!device.isScreenOn()) {
            log('isScreenOn判定失效，无法确认是否已亮屏。直接尝试后续解锁操作');
        }
    }
  
    // 划开图层
    this.swipe_layer = function () {
        log(['滑动解锁，设备分辨率：{},{}', _config.device_width, _config.device_height]);
        if (_config.device_width <= 0 || _config.device_height <= 0) {
            _config.device_width = device.width || 1080;
            _config.device_height = device.height || 2340;
            log(['设备分辨率不正确，建议重启AutoJs或者直接写死分辨率. 重置分辨率为{}*{}避免解锁失败', _config.device_width, _config.device_height]);
        }
        var x = parseInt(_config.device_width * 0.2);
        gesture(320, [x, parseInt(_config.device_height * 0.7)], [x, parseInt(_config.device_height * 0.3)]);
        sleep(_config.timeout_unlock);
    }
  
    // 执行解锁操作
    this.run_unlock = function () {
        this.relock = this.relock || this.getRelockInfo();
        // 如果已经解锁则返回
        if (!this.is_locked()) {
            log('已解锁');
            if (this.relock === true) {
                log('前置校验需要重新锁定屏幕');
            } else {
                log('不需要重新锁定屏幕');
                this.relock = false;
            }
            return true;
        }
        this.relock = true;
        _config.notNeedRelock = false;
        log('需要重新锁定屏幕');
        // 首先点亮屏幕
        this.wakeup();
        // 打开滑动层
        this.swipe_layer();
        // 如果有锁屏密码则输入密码
        if (this.is_passwd() && !this.unlock(_config.password)) {
            // 如果解锁失败
            this.failed();
        } else {
            this.saveNeedRelock();
            if (_config.dismiss_dialog_if_locked) {
            // 锁屏状态下启动不再弹框倒计时
            // _commonFunctions.getAndUpdateDismissReason('screen_locked')
            }
        }
    }
  
    this.saveNeedRelock = function (notRelock) {
      this.relock = this.relock || this.getRelockInfo()
      if (notRelock || _config.notNeedRelock) {
        this.relock = false
      }
      var storage = storages.create(_storageName)
      log('保存是否需要重新锁屏：' + this.relock)
      storage.put('needRelock', JSON.stringify({ needRelock: this.relock, timeout: new Date().getTime() + 30000 }))
    }
  
    this.getRelockInfo = function () {
        var storage = storages.create(_storageName);
        var needRelock = storage.get('needRelock');
        if (needRelock) {
            needRelock = JSON.parse(needRelock);
            if (needRelock && new Date().getTime() <= needRelock.timeout) {
                return needRelock.needRelock;
            }
        }
        return false;
    }
}
const MyDevice = NORMAL_DEVICE;
const _unlocker = new MyDevice(new Unlocker());

function exec() {
    _unlocker.reTry = 0;
    _unlocker.run_unlock();
    if (!_unlocker.relock) {
      var executeArguments = engines.myEngine().execArgv;
      // 定时任务启动 启用佛系模式
      if (_config.buddha_like_mode && executeArguments.intent && (!executeArguments.executeByDispatcher || executeArguments.buddha)) {
        log('已启用佛系模式，且未锁定屏幕，等待5分钟后再试')
        _config.forceStop = true;
        _config._buddha = true;
        // _commonFunctions.setUpAutoStart(5)
        exit();
      }
      var skipped = false;
      // 未锁定屏幕情况下，判断是否在白名单中
      do {
        // skipped = _commonFunctions.delayStartIfInSkipPackage()
        // 跳过了，需要重新执行解锁操作
        skipped && _unlocker.run_unlock();
      } while (skipped && !_unlocker.relock)
    }
}
exec();
// module.exports = {
//     exec: exec,
//     needRelock: function () {
//       logInfo('是否需要重新锁定屏幕：' + _unlocker.relock)
//       return _unlocker.relock
//     },
//     saveNeedRelock: function (notRelock) {
//       _unlocker.saveNeedRelock(notRelock)
//     },
//     unlocker: _unlocker
// }