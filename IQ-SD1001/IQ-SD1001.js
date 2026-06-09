
/**
 *__   _____  ____ ___ ___ ___  
 *\ \ / / _ \| __ )_ _|_ _/ _ \ 
 * \ V / | | |  _ \| | | | | | |
 * | || |_| | |_) | | | | |_| |
 * |_| \___/|____/___|___\__\_\
 *                              
 * 
 * YOBIIQ JS payload decoder compatible with TTN v3/v4 payload formatter and ChirpStack payload codec.
 * 
 * @author      Fostin Kpodar <f.kpodar@yobiiq.com>
 * @version     1.2.0
 * @copyright   YOBIIQ B.V. | https://www.yobiiq.com
 * 
 * @release     06/12/2023
 * @update      06/09/2026
 * 
 * @author      Dominic Hakke <d.hakke@yobiiq.com>
 * // Changes in header of document, naming conventions changed.
 * // Added support for temperature and humidity readings.
 *
 * @product     P1002015 iQ SD-1001 (Smoke Detector)
 * 
 * 
 */

// Version Control
var VERSION_CONTROL = {
    CODEC : {VERSION: "1.2.1", NAME: "codecVersion"},
    DEVICE: {MODEL : "SD-1001", NAME: "deviceModel"},
    PRODUCT: {CODE : "1002015", NAME: "productCode"},
    MANUFACTURER: {COMPANY : "YOBIIQ B.V.", NAME: "manufacturer"},
}

// Configuration constants for device basic info
var CONFIG_INFO = {
    FPORT     : 50,
    CHANNEL  : parseInt("0xFF", 16),
    TYPES    : {
        "0x09" : {SIZE : 2, NAME : "hardwareVersion", DIGIT: false},
        "0x0A" : {SIZE : 2, NAME : "firmwareVersion", DIGIT: false},
        "0x16" : {SIZE : 5, NAME : "deviceSerialNumber", DIGIT: true},
        "0x0F" : {SIZE : 1, NAME : "deviceClass",
            VALUES     : {
                "0x00" : "Class A",
                "0x01" : "Class B",
                "0x02" : "Class C",
            },
        },
        "0x0B" : {SIZE : 1, NAME : "powerEvent",
            VALUES     : {
                "0x00" : "AC Power Off",
                "0x01" : "AC Power On",
            },
        },
    },
    WARNING_NAME   : "warning",
    ERROR_NAME     : "error",
    INFO_NAME      : "info"
}

// Configuration constants for data registers
 var CONFIG_DATA = {
    FPORT   : 8,
    CHANNELS   : {
        "0x01" : {SIZE : 1, NAME : "batteryLevelInPercentage",},
        "0x02" : {SIZE : 1, NAME : "powerEvent",
            VALUES     : {
                "0x00" : "AC Power Off",
                "0x01" : "AC Power On",
            },
        },
        "0x03" : {SIZE : 1, NAME : "lowBatteryAlarm",
            VALUES     : {
                "0x00" : "Normal",
                "0x01" : "Alarm",
            },
        },
        "0x04" : {SIZE : 1, NAME : "faultAlarm",
            VALUES     : {
                "0x00" : "Normal",
                "0x01" : "Alarm",
            },
        },
        "0x05" : {SIZE : 1, NAME : "smokeAlarm",
            VALUES     : {
                "0x00" : "Normal",
                "0x01" : "Alarm",
            },
        },
        "0x06" : {SIZE : 1, NAME : "interconnectAlarm",
            VALUES     : {
                "0x00" : "Normal",
                "0x01" : "Alarm",
            },
        },
        "0x07" : {SIZE : 1, NAME : "testButtonPressed",
            VALUES     : {
                "0x00" : "Normal",
                "0x01" : "Pushed",
            },
        },
    },
    WARNING_NAME   : "warning",
    ERROR_NAME     : "error",
    INFO_NAME      : "info"
}

function isBasicInformation(bytes, fPort)
{
    if(fPort == CONFIG_INFO.FPORT)
    {
        return true;
    }
    if(bytes[0] == CONFIG_INFO.CHANNEL &&
        bytes[4] == CONFIG_INFO.CHANNEL &&
        bytes[8] == CONFIG_INFO.CHANNEL
    )
    {
        return true
    }
    return false;
}

function decodeBasicInformation(bytes)
{
    var LENGTH = bytes.length;
    var decoded = {};
    var index = 0;
    var channel = 0;
    var type = "";
    var size = 0;
    if(LENGTH == 1)
    {
        if(bytes[0] == 0)
        {
            decoded[CONFIG_INFO.INFO_NAME] = "Downlink command succeeded";

        } else if(bytes[0] == 1)
        {
            decoded[CONFIG_INFO.WARNING_NAME] = "Downlink command failed";
        }
        return decoded;
    }
    try
    {
        while(index < LENGTH)
        {
            channel = bytes[index];
            index = index + 1;
            if(channel != CONFIG_INFO.CHANNEL)
            {
                continue; // next byte
            }
            // Type of basic information
            type = "0x" + toEvenHEX(bytes[index].toString(16).toUpperCase());
            index = index + 1;
            var info = CONFIG_INFO.TYPES[type]
            size = info.SIZE;
            // Decoding
            var value = 0;
            if(size != 0)
            {
                if("DIGIT" in info)
                {
                    if(info.DIGIT == false)
                    {
                        value = getDigitStringArrayNoFormat(bytes, index, size);
                        value = "V" + value[0] + "." + value[1];
                    }else
                    {
                        value = getDigitStringArrayEvenFormat(bytes, index, size).join("");
                        value = parseInt(value, 10);
                    }
                }
                else if("VALUES" in info)
                {
                    value = "0x" + toEvenHEX(bytes[index].toString(16).toUpperCase());
                    value = info.VALUES[value];
                }else
                {
                    value = getValueFromBytesBigEndianFormat(bytes, index, size);
                }
                decoded[info.NAME] = value;
                index = index + size;
            }
        }
    }catch(error)
    {
        decoded[CONFIG_INFO.ERROR_NAME] = error.message;
    }

    return decoded;
}

function decodeDeviceData(bytes)
{
    var LENGTH = bytes.length;
    var decoded = {};
    var index = 0;
    var channel = "";
    var type = 0;
    var size = 0;
    if(LENGTH == 1)
    {
        if(bytes[0] == 0)
        {
            decoded[CONFIG_DATA.INFO_NAME] = "Downlink command succeeded";

        } else if(bytes[0] == 1)
        {
            decoded[CONFIG_DATA.WARNING_NAME] = "Downlink command failed";
        }
        return decoded;
    }
    try
    {
        while(index < LENGTH)
        {
            // Channel of device data
            channel = "0x" + toEvenHEX(bytes[index].toString(16).toUpperCase());
            index = index + 1;
            
            if (index >= LENGTH) break;

            // Type of device data
            type = bytes[index];
            index = index + 1;

            // Handle new Temperature and Humidity payload formats (Channel 0x80)
            if (channel === "0x80") {
                var typeHex = "0x" + toEvenHEX(type.toString(16).toUpperCase());
                
                if (typeHex === "0xA0") {
                    // Temperature datalog (Max 24 historical values, 2 bytes each = 48 bytes max)
                    var tempArray = [];
                    var tempEnd = Math.min(LENGTH, index + 48);
                    while (index + 1 < tempEnd) {
                        var rawTemp = getValueFromBytesBigEndianFormat(bytes, index, 2);
                        var tempVal = parseFloat((rawTemp * 0.1 - 30).toFixed(1));
                        tempArray.push(tempVal);
                        index += 2;
                    }
                    if (tempArray.length > 0) {
                        decoded["temperatureDatalog"] = tempArray;
                        decoded["temperature"] = tempArray[tempArray.length - 1]; // Current value
                    }
                } 
                else if (typeHex === "0xA1") {
                    // Humidity datalog (Max 24 historical values, 1 byte each = 24 bytes max)
                    var humiArray = [];
                    var humiEnd = Math.min(LENGTH, index + 24);
                    while (index < humiEnd) {
                        var rawHumi = bytes[index];
                        humiArray.push(rawHumi);
                        index += 1;
                    }
                    if (humiArray.length > 0) {
                        decoded["humidityDatalog"] = humiArray;
                        decoded["humidity"] = humiArray[humiArray.length - 1]; // Current value
                    }
                } 
                else if (typeHex === "0xA2") {
                    // Daily air quality (9 bytes total structure)
                    if (index + 9 <= LENGTH) {
                        var rawMaxTemp = getValueFromBytesBigEndianFormat(bytes, index, 2);
                        var rawMinTemp = getValueFromBytesBigEndianFormat(bytes, index + 2, 2);
                        var rawAvgTemp = getValueFromBytesBigEndianFormat(bytes, index + 4, 2);
                        
                        decoded["dailyMaxTemperature"] = parseFloat((rawMaxTemp * 0.1 - 30).toFixed(1));
                        decoded["dailyMinTemperature"] = parseFloat((rawMinTemp * 0.1 - 30).toFixed(1));
                        decoded["dailyAvgTemperature"] = parseFloat((rawAvgTemp * 0.1 - 30).toFixed(1));
                        
                        decoded["dailyMaxHumidity"] = bytes[index + 6];
                        decoded["dailyMinHumidity"] = bytes[index + 7];
                        decoded["dailyAvgHumidity"] = bytes[index + 8];
                        
                        index += 9;
                    } else {
                        throw new Error("Invalid payload length for daily air quality data structure");
                    }
                }
                continue;
            }

            var config = CONFIG_DATA.CHANNELS[channel];
            
            // Defensive parsing for unmapped/system configuration echoes (like 0xFF 0x03)
            if (!config) {
                if (channel === "0xFF") {
                    var sysTypeHex = "0x" + toEvenHEX(type.toString(16).toUpperCase());
                    var sysInfo = CONFIG_INFO.TYPES[sysTypeHex];
                    
                    var sysSize = null;
                    if (sysTypeHex === "0x03") sysSize = 2; // reportingInterval
                    else if (sysTypeHex === "0x00") sysSize = 1; // smokeDetector
                    else if (sysTypeHex === "0x0A") sysSize = 2; // silenceBuzzer
                    else if (sysTypeHex === "0x01") sysSize = 1; // confirmedUplink
                    
                    size = sysInfo ? sysInfo.SIZE : sysSize;
                    if (size !== null && size !== undefined) {
                        index = index + size;
                        continue;
                    }
                }
                // Stop processing unknown byte signatures entirely to avoid infinite loops
                break;
            }

            size = config.SIZE;
            // Decoding
            var value = 0;
            if("VALUES" in config)
            {
                value = "0x" + toEvenHEX(bytes[index].toString(16).toUpperCase());
                value = config.VALUES[value];
            }else
            {
                value = getValueFromBytesBigEndianFormat(bytes, index, size);
            }
            decoded[config.NAME] = value;
            index = index + size;
        }
    }catch(error)
    {
        decoded[CONFIG_DATA.ERROR_NAME] = error.message;
    }
    return decoded;
}

function getValueFromBytesBigEndianFormat(bytes, index, size)
{
    var value = 0;
    for(var i=0; i<(size-1); i=i+1)
    {
        value = (value | bytes[index+i]) << 8; 
    }
    value = value | bytes[index+size-1]
    return (value >>> 0); // to unsigned
}

function getValueFromBytesLittleEndianFormat(bytes, index, size)
{
    var value = 0;
    for(var i=(size-1); i>0; i=i-1)
    {
        value = (value | bytes[index+i]) << 8; 
    }
    value = value | bytes[index]
    return (value >>> 0); // to unsigned
}

function getDigitStringArrayNoFormat(bytes, index, size)
{
  var hexString = []
  for(var i=0; i<size; i=i+1)
  {
    hexString.push(bytes[index+i].toString(16));
  }
  return hexString
}

function getDigitStringArrayEvenFormat(bytes, index, size)
{
  var hexString = []
  for(var i=0; i<size; i=i+1)
  {
    hexString.push(bytes[index+i].toString(16));
  }
  return hexString.map(toEvenHEX)
}

function toEvenHEX(hex)
{
  if(hex.length == 1)
  {
    return "0"+hex;
  }
  return hex;
}

/************************************************************************************************************/

function Decode(fPort, bytes, variables) 
{
    var decoded = {};
    if(isBasicInformation(bytes, fPort))
    {
        decoded = decodeBasicInformation(bytes);
    }else
    {
        decoded = decodeDeviceData(bytes);
    }
    decoded[VERSION_CONTROL.CODEC.NAME] = VERSION_CONTROL.CODEC.VERSION;
    decoded[VERSION_CONTROL.DEVICE.NAME] = VERSION_CONTROL.DEVICE.MODEL;
    decoded[VERSION_CONTROL.PRODUCT.NAME] = VERSION_CONTROL.PRODUCT.CODE;
    decoded[VERSION_CONTROL.MANUFACTURER.NAME] = VERSION_CONTROL.MANUFACTURER.COMPANY;
    return decoded;
}

function decodeUplink(input) {
    return {
        data: Decode(input.fPort, input.bytes, input.variables)
    };
}

/************************************************************************************************************/

function Encode(fPort, obj, variables) {
    try
    {
        if(obj[CONFIG_DOWNLINK.TYPE] == CONFIG_DOWNLINK.CONFIG)
        {
            return encodeDeviceConfiguration(obj[CONFIG_DOWNLINK.CONFIG], variables);
        }
    }catch(error)
    {

    }
    return [];
}

function encodeDownlink(input) {
    return {
        bytes: Encode(null, input.data, input.variables)
    };
}

/************************************************************************************************************/

// Constants for device configuration 
var CONFIG_DEVICE = {
    PORT : 50,
    CHANNEL : parseInt("0xFF", 16),
    TYPES : {
        "reportingInterval" : {TYPE : parseInt("0x03", 16), SIZE : 2, MIN : 1, MAX : 65535,},
        "smokeDetector" : {TYPE : parseInt("0x00", 16), SIZE : 1, MIN : 0, MAX : 1,},
        "silenceBuzzer" : {TYPE : parseInt("0x0A", 16), SIZE : 2, MIN : 0, MAX : 65535,},
        "confirmedUplink" : {TYPE : parseInt("0x01", 16), SIZE : 1, MIN : 0, MAX : 1,},
    }
}

// Constants for downlink
var CONFIG_DOWNLINK = {
    TYPE    : "Type",
    CONFIG  : "Config"
}

function encodeDeviceConfiguration(obj, variables)
{
    var encoded = []
    var index = 0;
    var field = ["Param", "Value"];
    try
    {
        var config = CONFIG_DEVICE.TYPES[obj[field[0]]];
        var value = obj[field[1]];
        if(obj[field[1]] >= config["MIN"] && obj[field[1]] <= config["MAX"])
        {
            encoded[index] = CONFIG_DEVICE.CHANNEL;
            index = index + 1;
            encoded[index] = config.TYPE;
            index = index + 1;
            if(config.SIZE == 1)
            {
                encoded[index] = value;
                index = index + 1;
            }else if(config.SIZE == 2)
            {
                switch(config.TYPE)
                {
                    case 3: // reporting interval
                        var lowByte = value % 256;
                        encoded[index] = ((lowByte & parseInt("0x0F", 16)) << 4) +  (lowByte >> 4);
                        index = index + 1;
                        encoded[index] = (value >> 8) % 256;
                        index = index + 1;
                        break;
                    default:
                        encoded[index] = (value >> 8) % 256;
                        index = index + 1;
                        encoded[index] = value % 256;
                        index = index + 1;
                        break;
                }
            }
        }else
        {
            return [];
        }
    }catch(error)
    {
        return [];
    }
    return encoded;
}
