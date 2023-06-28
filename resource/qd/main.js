auto.waitFor("fast"); //检查无障碍权限启动
//随机休眠
var sleep_time = random(0, 1 * 4 * 1000);
sleep_time += 1500;
log(sleep_time + "后执行");
toast(sleep_time + "后执行");
sleep(sleep_time);

require("./解锁.js");
// let Robot = require("./lib/Robot.js");
// let WidgetAutomator = require("./lib/WidgetAutomator.js");
// let robot = new Robot();
// let widget = new WidgetAutomator(robot);

toast('Hello, AutoX.js');
