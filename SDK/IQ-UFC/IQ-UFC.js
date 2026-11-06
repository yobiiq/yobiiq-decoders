/**
 *__   _____  ____ ___ ___ ___
 *\ \ / / _ \| __ )_ _|_ _/ _ \
 * \ V / | | |  _ \| | | | | | |
 * | || |_| | |_) | | | | |_| |
 * |_| \___/|____/___|___\__\_\
 *
 *
 * @brief This YOBIIQ JS payload decoder/encoder follows the LoRa Alliance Payload Codec API specs (TS013-1.0.0).
 *
 * @compatibility ChirpStack v3 (Decode/Encode, otto ES5 engine), ChirpStack v4 (decodeUplink/encodeDownlink,
 *                QuickJS), TTN, TTI, LORIOT, ThingPark and any LNS that follows LoRa Alliance API specs.
 *                Written in ES3 syntax without ES5+ library calls, console or global state between calls.
 *
 * @author      Fostin Kpodar <f.kpodar@yobiiq.com>
 * @version     1.3.0
 * @copyright   YOBIIQ B.V. | https://www.yobiiq.com
 *
 * @release     06-11-2026
 * @update      06-11-2026
 *
 * @product     P1002029   IQ UFC (iQ UFHCC underfloor heating and cooling controller)
 *
 * @firmware    IQ UFC v1.3.0
 *
 */


// Added to every decoded uplink, without overwriting decoded fields.
var CODEC_INFO = {
    codecVersion: "1.3.0",
    genericModel: "IQ UFC",
    productCode: "P1002029",
    manufacturer: "YOBIIQ B.V."
};

var FPORT = {
    MAC: 0,
    PERIODIC_MIN: 1,
    PERIODIC_MAX: 10,
    GENERIC: 50,
    READING: 100
};

var MESSAGES = {
    MAC: "MAC COMMAND RECEIVED",
    DOWNLINK_SUCCESS: "DOWNLINK COMMAND SUCCEEDED",
    DOWNLINK_FAILURE: "DOWNLINK COMMAND FAILED",
    FPORT_INCORRECT: "Incorrect fPort",
    CMD_INVALID: "Invalid command",
    CMD_REGISTER_NOT_FOUND: "Register not found in the device registers",
    CMD_REGISTER_NOT_WRITABLE: "Register not writable",
    CMD_REGISTER_NOT_READABLE: "Register not readable",
    CMD_REGISTER_NUMBER_INVALID: "Invalid number of registers",
    CMD_DATA_INVALID: "Invalid data in the command",
    CMD_FPORT_INVALID: "Invalid fPort in the command",
    CMD_TOO_LONG: "Command too long"
};

var LIMITS = {
    COMMAND_REGISTERS: 10,      // registers per Reading or Periodic command
    STRING_LENGTH: 31,          // longest name the firmware takes
    DOWNLINK_SIZE: 51           // EU868 limit at DR0 to DR2: the firmware takes no longer downlink
};

var OFF_ON = {0: "OFF", 1: "ON"};
var DISABLED_ENABLED = {0: "DISABLED", 1: "ENABLED"};
var NORMAL_ALARM = {0: "NORMAL", 1: "ALARM"};
var CLOSED_OPEN = {0: "CLOSED", 1: "OPEN"};
var DEVICE_CLASS_VALUES = {0: "CLASS_A", 1: "CLASS_B", 2: "CLASS_C"};
var SYSTEM_MODE_VALUES = {0: "OFF", 1: "HEATING", 2: "COOLING", 3: "MANUAL_OPEN", 4: "MANUAL_CLOSE"};
var OUTPUT_STATE_SETTING_VALUES = {0: "AUTO", 1: "ON", 2: "OFF", 3: "PRIMARY_HEATER", 4: "PRIMARY_COOLER",
    5: "PRIMARY_HEATER_COOLER"};
var MOTOR_TYPE_VALUES = {0: "NC", 1: "NO"};
var THERMOSTAT_TYPE_VALUES = {0: "NONE", 1: "TH1", 2: "TH2", 3: "IQ_D2D", 4: "INTERNAL"};
var GROUP_MODE_VALUES = {0: "OFF", 1: "STANDBY", 2: "COMFORT"};
var OVERRIDE_OUTPUT_VALUES = {0: "AUTO", 1: "ON", 2: "OFF"};
var OUTPUT_CONTROL_VALUES = {0: "OPEN_CLOSE", 1: "PWM"};
var MODBUS_PROTOCOL_VALUES = {0: "TCP", 1: "RTU_OVER_TCP", 2: "ASCII_OVER_TCP"};

// Output Alarms: Overcurrent in the high byte, Output Alarm in the low byte, each 0 or 1.
var OUTPUT_ALARM_FLAGS = [
    {NAME: "overcurrent", BIT: 8, VALUES: ["NORMAL", "ALARM"]},
    {NAME: "outputAlarm", BIT: 0, VALUES: ["NORMAL", "ALARM"]}
];

/*
 * Register table: one entry per register address, used to decode uplinks AND
 * to encode downlinks, so the two directions can never disagree on an address.
 * Temperatures are in degrees Celsius (raw x 0.01), currents in mA, voltages in mV, powers in mW.
 *
 *   NAME        key in the decoded object, Param / Registers name in commands
 *   TYPE        U8 U16 U32 I16 STR VER VER3 ENUM FLAGS IP4
 *   RW          what the firmware accepts over LoRaWAN: "R", "W", "RW" or "" (uplink only)
 *   RESOLUTION  decoded value = raw * RESOLUTION (and raw = value / RESOLUTION when encoding)
 *   DECIMALS    rounding of scaled values (default 3)
 *   VALUES      ENUM labels by raw value; unknown values decode as "UNKNOWN (<raw>)"
 *   FLAGS       FLAGS bits: [{NAME: ..., BIT: n, VALUES: [label when 0, label when 1]}]
 *   SIZE        byte size of FLAGS registers
 *   MIN, MAX    accepted range of written values (in decoded units; ENUM: raw values); STR: length
 */
var REGISTERS = {

    /* Uplink header of periodic uplinks (not a register) */
    "0xFF01": {NAME: "dataloggerTimestamp", TYPE: "U32", RW: ""},

    /* Generic registers of the YOBIIQ SDK served by the UFC (lorawan_at README, section 4) */
    "0xFF32": {NAME: "buildingName", TYPE: "STR", RW: "RW", MIN: 0, MAX: 31},
    "0xFF33": {NAME: "buildingRoom", TYPE: "STR", RW: "RW", MIN: 0, MAX: 31},
    "0xFF34": {NAME: "deviceName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0xFF64": {NAME: "deviceStatus", TYPE: "ENUM", RW: "R", VALUES: {0: "NORMAL_MODE", 1: "SPECIAL_MODE"}},
    "0xFF65": {NAME: "manufacturer", TYPE: "STR", RW: "R"},
    "0xFF66": {NAME: "originalEquipmentManufacturer", TYPE: "STR", RW: "R"},
    "0xFF67": {NAME: "deviceModel", TYPE: "STR", RW: "R"},
    "0xFF68": {NAME: "deviceSerialNumber", TYPE: "U32", RW: "R"},
    "0xFF69": {NAME: "firmwareVersion", TYPE: "VER", RW: "R"},
    "0xFF6A": {NAME: "hardwareVersion", TYPE: "VER", RW: "R"},
    "0xFF6B": {NAME: "externalPowerStatus", TYPE: "ENUM", RW: "R", VALUES: {0: "BATTERY_POWER", 1: "MAINS_POWER"}},
    "0xFF6C": {NAME: "batteryVoltage", TYPE: "U8", RW: "R", RESOLUTION: 0.1, DECIMALS: 1},
    "0xFF6F": {NAME: "rebootDevice", TYPE: "U8", RW: "W", MIN: 1, MAX: 1},
    "0xFF78": {NAME: "internalCircuitTemperatureAlarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},
    "0xFF79": {NAME: "internalCircuitTemperatureNumberOfAlarms", TYPE: "U32", RW: "R"},
    "0xFF7A": {NAME: "internalCircuitTemperature", TYPE: "I16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0xFF7B": {NAME: "internalCircuitHumidity", TYPE: "U8", RW: "R"},
    "0xFF95": {NAME: "restartLoRaWAN", TYPE: "U8", RW: "W", MIN: 1, MAX: 1},
    "0xFF96": {NAME: "joinStatus", TYPE: "ENUM", RW: "R", VALUES: {0: "OFFLINE", 1: "ONLINE"}},
    "0xFF97": {NAME: "radioModule", TYPE: "STR", RW: "R"},
    "0xFF98": {NAME: "lorawanRegion", TYPE: "ENUM", RW: "R", VALUES: {1: "EU868"}},
    "0xFF99": {NAME: "lorawanVersion", TYPE: "VER3", RW: "R"},
    "0xFF9D": {NAME: "applicationPort", TYPE: "U8", RW: "R"},
    "0xFF9E": {NAME: "joinType", TYPE: "ENUM", RW: "R", VALUES: {1: "OTAA"}},
    // Always class C: a write of class A or B fails the whole session
    "0xFF9F": {NAME: "deviceClass", TYPE: "ENUM", RW: "RW", MIN: 2, MAX: 2, VALUES: DEVICE_CLASS_VALUES},
    "0xFFA0": {NAME: "adr", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    // Stored only
    "0xFFA3": {NAME: "radioMode", TYPE: "ENUM", RW: "RW", VALUES: {0: "LORAWAN", 1: "IQ_D2D", 2: "LORAWAN_AND_IQ_D2D"}},
    "0xFFA6": {NAME: "dataRetransmission", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xFFA7": {NAME: "lorawanWatchdogAlarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* System (0x00xx) */
    "0x0000": {NAME: "systemOperatingMode", TYPE: "ENUM", RW: "RW", VALUES: SYSTEM_MODE_VALUES},
    "0x0001": {NAME: "heatingSetpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x0002": {NAME: "heatingSetpointMax", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x0003": {NAME: "coolingSetpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x0004": {NAME: "coolingSetpointMin", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x0005": {NAME: "flowTemperatureMin", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x0006": {NAME: "flowTemperatureMax", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},

    /* Output CH1 (0x0100) */
    "0x0100": {NAME: "channel1OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0101": {NAME: "channel1OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0102": {NAME: "channel1OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0103": {NAME: "channel1OutputPower", TYPE: "U32", RW: "R"},
    "0x0104": {NAME: "channel1OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0110": {NAME: "channel1OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0111": {NAME: "channel1RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0112": {NAME: "channel1Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0113": {NAME: "channel1Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0114": {NAME: "channel1OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0115": {NAME: "channel1MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0116": {NAME: "channel1OpenTime", TYPE: "U16", RW: "RW"},
    "0x0117": {NAME: "channel1PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0118": {NAME: "channel1MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0119": {NAME: "channel1EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x011A": {NAME: "channel1EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH2 (0x0200) */
    "0x0200": {NAME: "channel2OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0201": {NAME: "channel2OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0202": {NAME: "channel2OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0203": {NAME: "channel2OutputPower", TYPE: "U32", RW: "R"},
    "0x0204": {NAME: "channel2OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0210": {NAME: "channel2OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0211": {NAME: "channel2RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0212": {NAME: "channel2Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0213": {NAME: "channel2Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0214": {NAME: "channel2OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0215": {NAME: "channel2MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0216": {NAME: "channel2OpenTime", TYPE: "U16", RW: "RW"},
    "0x0217": {NAME: "channel2PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0218": {NAME: "channel2MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0219": {NAME: "channel2EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x021A": {NAME: "channel2EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH3 (0x0300) */
    "0x0300": {NAME: "channel3OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0301": {NAME: "channel3OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0302": {NAME: "channel3OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0303": {NAME: "channel3OutputPower", TYPE: "U32", RW: "R"},
    "0x0304": {NAME: "channel3OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0310": {NAME: "channel3OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0311": {NAME: "channel3RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0312": {NAME: "channel3Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0313": {NAME: "channel3Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0314": {NAME: "channel3OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0315": {NAME: "channel3MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0316": {NAME: "channel3OpenTime", TYPE: "U16", RW: "RW"},
    "0x0317": {NAME: "channel3PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0318": {NAME: "channel3MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0319": {NAME: "channel3EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x031A": {NAME: "channel3EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH4 (0x0400) */
    "0x0400": {NAME: "channel4OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0401": {NAME: "channel4OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0402": {NAME: "channel4OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0403": {NAME: "channel4OutputPower", TYPE: "U32", RW: "R"},
    "0x0404": {NAME: "channel4OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0410": {NAME: "channel4OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0411": {NAME: "channel4RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0412": {NAME: "channel4Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0413": {NAME: "channel4Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0414": {NAME: "channel4OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0415": {NAME: "channel4MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0416": {NAME: "channel4OpenTime", TYPE: "U16", RW: "RW"},
    "0x0417": {NAME: "channel4PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0418": {NAME: "channel4MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0419": {NAME: "channel4EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x041A": {NAME: "channel4EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH5 (0x0500) */
    "0x0500": {NAME: "channel5OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0501": {NAME: "channel5OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0502": {NAME: "channel5OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0503": {NAME: "channel5OutputPower", TYPE: "U32", RW: "R"},
    "0x0504": {NAME: "channel5OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0510": {NAME: "channel5OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0511": {NAME: "channel5RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0512": {NAME: "channel5Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0513": {NAME: "channel5Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0514": {NAME: "channel5OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0515": {NAME: "channel5MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0516": {NAME: "channel5OpenTime", TYPE: "U16", RW: "RW"},
    "0x0517": {NAME: "channel5PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0518": {NAME: "channel5MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0519": {NAME: "channel5EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x051A": {NAME: "channel5EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH6 (0x0600) */
    "0x0600": {NAME: "channel6OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0601": {NAME: "channel6OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0602": {NAME: "channel6OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0603": {NAME: "channel6OutputPower", TYPE: "U32", RW: "R"},
    "0x0604": {NAME: "channel6OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0610": {NAME: "channel6OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0611": {NAME: "channel6RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0612": {NAME: "channel6Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0613": {NAME: "channel6Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0614": {NAME: "channel6OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0615": {NAME: "channel6MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0616": {NAME: "channel6OpenTime", TYPE: "U16", RW: "RW"},
    "0x0617": {NAME: "channel6PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0618": {NAME: "channel6MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0619": {NAME: "channel6EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x061A": {NAME: "channel6EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH7 (0x0700) */
    "0x0700": {NAME: "channel7OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0701": {NAME: "channel7OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0702": {NAME: "channel7OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0703": {NAME: "channel7OutputPower", TYPE: "U32", RW: "R"},
    "0x0704": {NAME: "channel7OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0710": {NAME: "channel7OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0711": {NAME: "channel7RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0712": {NAME: "channel7Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0713": {NAME: "channel7Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0714": {NAME: "channel7OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0715": {NAME: "channel7MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0716": {NAME: "channel7OpenTime", TYPE: "U16", RW: "RW"},
    "0x0717": {NAME: "channel7PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0718": {NAME: "channel7MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0719": {NAME: "channel7EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x071A": {NAME: "channel7EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH8 (0x0800) */
    "0x0800": {NAME: "channel8OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0801": {NAME: "channel8OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0802": {NAME: "channel8OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0803": {NAME: "channel8OutputPower", TYPE: "U32", RW: "R"},
    "0x0804": {NAME: "channel8OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0810": {NAME: "channel8OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0811": {NAME: "channel8RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0812": {NAME: "channel8Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0813": {NAME: "channel8Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0814": {NAME: "channel8OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0815": {NAME: "channel8MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0816": {NAME: "channel8OpenTime", TYPE: "U16", RW: "RW"},
    "0x0817": {NAME: "channel8PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0818": {NAME: "channel8MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0819": {NAME: "channel8EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x081A": {NAME: "channel8EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH9 (0x0900) */
    "0x0900": {NAME: "channel9OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0901": {NAME: "channel9OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0902": {NAME: "channel9OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0903": {NAME: "channel9OutputPower", TYPE: "U32", RW: "R"},
    "0x0904": {NAME: "channel9OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0910": {NAME: "channel9OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0911": {NAME: "channel9RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0912": {NAME: "channel9Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0913": {NAME: "channel9Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0914": {NAME: "channel9OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0915": {NAME: "channel9MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0916": {NAME: "channel9OpenTime", TYPE: "U16", RW: "RW"},
    "0x0917": {NAME: "channel9PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0918": {NAME: "channel9MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0919": {NAME: "channel9EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x091A": {NAME: "channel9EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH10 (0x0A00) */
    "0x0A00": {NAME: "channel10OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0A01": {NAME: "channel10OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0A02": {NAME: "channel10OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0A03": {NAME: "channel10OutputPower", TYPE: "U32", RW: "R"},
    "0x0A04": {NAME: "channel10OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0A10": {NAME: "channel10OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0A11": {NAME: "channel10RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0A12": {NAME: "channel10Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0A13": {NAME: "channel10Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0A14": {NAME: "channel10OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0A15": {NAME: "channel10MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0A16": {NAME: "channel10OpenTime", TYPE: "U16", RW: "RW"},
    "0x0A17": {NAME: "channel10PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0A18": {NAME: "channel10MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0A19": {NAME: "channel10EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0A1A": {NAME: "channel10EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH11 (0x0B00) */
    "0x0B00": {NAME: "channel11OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0B01": {NAME: "channel11OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0B02": {NAME: "channel11OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0B03": {NAME: "channel11OutputPower", TYPE: "U32", RW: "R"},
    "0x0B04": {NAME: "channel11OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0B10": {NAME: "channel11OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0B11": {NAME: "channel11RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0B12": {NAME: "channel11Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0B13": {NAME: "channel11Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0B14": {NAME: "channel11OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0B15": {NAME: "channel11MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0B16": {NAME: "channel11OpenTime", TYPE: "U16", RW: "RW"},
    "0x0B17": {NAME: "channel11PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0B18": {NAME: "channel11MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0B19": {NAME: "channel11EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0B1A": {NAME: "channel11EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Output CH12 (0x0C00) */
    "0x0C00": {NAME: "channel12OutputState", TYPE: "ENUM", RW: "R", VALUES: CLOSED_OPEN},
    "0x0C01": {NAME: "channel12OutputCurrent", TYPE: "U16", RW: "R"},
    "0x0C02": {NAME: "channel12OutputVoltage", TYPE: "U16", RW: "R"},
    "0x0C03": {NAME: "channel12OutputPower", TYPE: "U32", RW: "R"},
    "0x0C04": {NAME: "channel12OutputAlarms", TYPE: "FLAGS", RW: "R", FLAGS: OUTPUT_ALARM_FLAGS, SIZE: 2},
    "0x0C10": {NAME: "channel12OutputStateSetting", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_STATE_SETTING_VALUES},
    "0x0C11": {NAME: "channel12RelatedGroupId", TYPE: "U8", RW: "RW", MIN: 0, MAX: 11},
    "0x0C12": {NAME: "channel12Heating", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0C13": {NAME: "channel12Cooling", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0C14": {NAME: "channel12OutputName", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x0C15": {NAME: "channel12MotorType", TYPE: "ENUM", RW: "RW", VALUES: MOTOR_TYPE_VALUES},
    "0x0C16": {NAME: "channel12OpenTime", TYPE: "U16", RW: "RW"},
    "0x0C17": {NAME: "channel12PeakCurrent", TYPE: "U16", RW: "RW"},
    "0x0C18": {NAME: "channel12MinimumCurrent", TYPE: "U16", RW: "RW"},
    "0x0C19": {NAME: "channel12EnablePeriodicCheck", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0C1A": {NAME: "channel12EnableCurrentDraw", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Group GR1 (0x1100) */
    "0x1100": {NAME: "group1ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1101": {NAME: "group1OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1102": {NAME: "group1Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1103": {NAME: "group1Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1104": {NAME: "group1Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1105": {NAME: "group1OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1106": {NAME: "group1OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1107": {NAME: "group1Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1108": {NAME: "group1SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1109": {NAME: "group1ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x110A": {NAME: "group1IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x110B": {NAME: "group1Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x110C": {NAME: "group1Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR2 (0x1200) */
    "0x1200": {NAME: "group2ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1201": {NAME: "group2OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1202": {NAME: "group2Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1203": {NAME: "group2Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1204": {NAME: "group2Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1205": {NAME: "group2OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1206": {NAME: "group2OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1207": {NAME: "group2Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1208": {NAME: "group2SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1209": {NAME: "group2ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x120A": {NAME: "group2IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x120B": {NAME: "group2Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x120C": {NAME: "group2Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR3 (0x1300) */
    "0x1300": {NAME: "group3ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1301": {NAME: "group3OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1302": {NAME: "group3Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1303": {NAME: "group3Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1304": {NAME: "group3Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1305": {NAME: "group3OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1306": {NAME: "group3OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1307": {NAME: "group3Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1308": {NAME: "group3SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1309": {NAME: "group3ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x130A": {NAME: "group3IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x130B": {NAME: "group3Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x130C": {NAME: "group3Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR4 (0x1400) */
    "0x1400": {NAME: "group4ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1401": {NAME: "group4OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1402": {NAME: "group4Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1403": {NAME: "group4Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1404": {NAME: "group4Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1405": {NAME: "group4OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1406": {NAME: "group4OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1407": {NAME: "group4Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1408": {NAME: "group4SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1409": {NAME: "group4ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x140A": {NAME: "group4IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x140B": {NAME: "group4Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x140C": {NAME: "group4Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR5 (0x1500) */
    "0x1500": {NAME: "group5ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1501": {NAME: "group5OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1502": {NAME: "group5Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1503": {NAME: "group5Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1504": {NAME: "group5Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1505": {NAME: "group5OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1506": {NAME: "group5OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1507": {NAME: "group5Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1508": {NAME: "group5SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1509": {NAME: "group5ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x150A": {NAME: "group5IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x150B": {NAME: "group5Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x150C": {NAME: "group5Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR6 (0x1600) */
    "0x1600": {NAME: "group6ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1601": {NAME: "group6OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1602": {NAME: "group6Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1603": {NAME: "group6Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1604": {NAME: "group6Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1605": {NAME: "group6OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1606": {NAME: "group6OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1607": {NAME: "group6Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1608": {NAME: "group6SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1609": {NAME: "group6ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x160A": {NAME: "group6IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x160B": {NAME: "group6Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x160C": {NAME: "group6Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR7 (0x1700) */
    "0x1700": {NAME: "group7ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1701": {NAME: "group7OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1702": {NAME: "group7Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1703": {NAME: "group7Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1704": {NAME: "group7Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1705": {NAME: "group7OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1706": {NAME: "group7OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1707": {NAME: "group7Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1708": {NAME: "group7SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1709": {NAME: "group7ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x170A": {NAME: "group7IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x170B": {NAME: "group7Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x170C": {NAME: "group7Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR8 (0x1800) */
    "0x1800": {NAME: "group8ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1801": {NAME: "group8OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1802": {NAME: "group8Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1803": {NAME: "group8Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1804": {NAME: "group8Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1805": {NAME: "group8OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1806": {NAME: "group8OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1807": {NAME: "group8Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1808": {NAME: "group8SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1809": {NAME: "group8ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x180A": {NAME: "group8IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x180B": {NAME: "group8Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x180C": {NAME: "group8Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR9 (0x1900) */
    "0x1900": {NAME: "group9ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1901": {NAME: "group9OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1902": {NAME: "group9Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1903": {NAME: "group9Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1904": {NAME: "group9Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1905": {NAME: "group9OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1906": {NAME: "group9OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1907": {NAME: "group9Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1908": {NAME: "group9SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1909": {NAME: "group9ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x190A": {NAME: "group9IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x190B": {NAME: "group9Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x190C": {NAME: "group9Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR10 (0x1A00) */
    "0x1A00": {NAME: "group10ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1A01": {NAME: "group10OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1A02": {NAME: "group10Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1A03": {NAME: "group10Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1A04": {NAME: "group10Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1A05": {NAME: "group10OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1A06": {NAME: "group10OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1A07": {NAME: "group10Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1A08": {NAME: "group10SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1A09": {NAME: "group10ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x1A0A": {NAME: "group10IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x1A0B": {NAME: "group10Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x1A0C": {NAME: "group10Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR11 (0x1B00) */
    "0x1B00": {NAME: "group11ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1B01": {NAME: "group11OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1B02": {NAME: "group11Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1B03": {NAME: "group11Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1B04": {NAME: "group11Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1B05": {NAME: "group11OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1B06": {NAME: "group11OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1B07": {NAME: "group11Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1B08": {NAME: "group11SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1B09": {NAME: "group11ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x1B0A": {NAME: "group11IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x1B0B": {NAME: "group11Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x1B0C": {NAME: "group11Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Group GR12 (0x1C00) */
    "0x1C00": {NAME: "group12ThermostatType", TYPE: "ENUM", RW: "RW", VALUES: THERMOSTAT_TYPE_VALUES},
    "0x1C01": {NAME: "group12OperatingMode", TYPE: "ENUM", RW: "RW", VALUES: GROUP_MODE_VALUES},
    "0x1C02": {NAME: "group12Setpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1C03": {NAME: "group12Name", TYPE: "STR", RW: "RW", MIN: 1, MAX: 31},
    "0x1C04": {NAME: "group12Temperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x1C05": {NAME: "group12OverrideOutput", TYPE: "ENUM", RW: "RW", VALUES: OVERRIDE_OUTPUT_VALUES},
    "0x1C06": {NAME: "group12OutputControl", TYPE: "ENUM", RW: "RW", VALUES: OUTPUT_CONTROL_VALUES},
    "0x1C07": {NAME: "group12Deadband", TYPE: "U8", RW: "RW", RESOLUTION: 0.1, DECIMALS: 1, MIN: 0, MAX: 3},
    "0x1C08": {NAME: "group12SetpointOverride", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x1C09": {NAME: "group12ThermostatTimeout", TYPE: "U8", RW: "RW"},
    "0x1C0A": {NAME: "group12IqD2dSerialNumber", TYPE: "U32", RW: "RW"},
    "0x1C0B": {NAME: "group12Regulating", TYPE: "ENUM", RW: "R", VALUES: OFF_ON},
    "0x1C0C": {NAME: "group12Alarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},

    /* Main 24 V power input (0x20xx) */
    "0x2001": {NAME: "mainCurrent", TYPE: "U16", RW: "R"},
    "0x2002": {NAME: "mainVoltage", TYPE: "U16", RW: "R"},
    "0x2003": {NAME: "mainPower", TYPE: "U32", RW: "R"},

    /* Thermostats (0x31xx to 0x34xx): TH1 and TH2 read from OpenTherm, Internal fed by the building system */
    "0x3100": {NAME: "th1RoomTemperature", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0x3101": {NAME: "th1RoomSetpoint", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0x3200": {NAME: "th2RoomTemperature", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0x3201": {NAME: "th2RoomSetpoint", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0x3400": {NAME: "internalRoomTemperature", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x3401": {NAME: "internalRoomSetpoint", TYPE: "U16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x3402": {NAME: "outdoorTemperature", TYPE: "I16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},
    "0x3403": {NAME: "flowTemperature", TYPE: "I16", RW: "RW", RESOLUTION: 0.01, DECIMALS: 2},

    /* Network (0x40xx) */
    "0x4000": {NAME: "enableModbus", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x4001": {NAME: "enableDhcp", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x4002": {NAME: "enableBacnet", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    // DISABLED leaves the network
    "0x4003": {NAME: "enableLorawan", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x4004": {NAME: "deviceIpAddress", TYPE: "IP4", RW: "RW"},
    "0x4005": {NAME: "gatewayIpAddress", TYPE: "IP4", RW: "RW"},
    "0x4006": {NAME: "subnetMask", TYPE: "IP4", RW: "RW"},
    "0x4007": {NAME: "dnsServerIpAddress", TYPE: "IP4", RW: "RW"},
    // Stored and read back, but only TCP is applied
    "0x4008": {NAME: "modbusProtocolMode", TYPE: "ENUM", RW: "RW", VALUES: MODBUS_PROTOCOL_VALUES}
};

var TYPE_SIZES = {U8: 1, U16: 2, U32: 4, I16: 2, VER: 2, VER3: 3, ENUM: 1, IP4: 4};

// Register name -> "0xABCD" key, for the encoder only. registerKeys() builds it on first use:
// ChirpStack v3 parses and runs the whole codec for every uplink within a 100 ms limit, so
// uplinks skip this work. It only caches the constant REGISTERS table.
var REGISTER_KEYS = null;

// Periodic uplink configuration fields (downlink on fPorts 1-10).
var PERIODIC = {
    CHANNEL: 0xFF,
    INTERVAL: 0x14,
    MODE: 0x15,
    STATUS: 0x16,
    REGISTERS: 0x17
};

var READING = {
    CHANNEL: 0xFF,
    TYPE: 0xCC
};

// fPort used by encodeDownlink() when the command has none.
var COMMAND_FPORTS = {
    Config: FPORT.GENERIC,
    Reading: FPORT.READING
};

/************************************************************************************************************/
/* Uplink decoding                                                                                          */
/************************************************************************************************************/

function decodePayload(fPort, bytes) {
    var result = {data: {}, errors: [], warnings: []};
    if (fPort === FPORT.MAC) {
        result.data.mac = MESSAGES.MAC;
        result.data.fPort = fPort;
    } else if (bytes.length === 1 && (bytes[0] === 0 || bytes[0] === 1)) {
        // One byte status reply to a downlink, on the fPort of the command.
        if (bytes[0] === 0) {
            result.data.info = MESSAGES.DOWNLINK_SUCCESS;
        } else {
            addWarning(result, MESSAGES.DOWNLINK_FAILURE);
        }
    } else if ((fPort >= FPORT.PERIODIC_MIN && fPort <= FPORT.PERIODIC_MAX) || fPort === FPORT.GENERIC ||
            fPort === FPORT.READING) {
        decodeRecords(bytes, 0, result);
    } else {
        result.data.fPort = fPort;
        addError(result, MESSAGES.FPORT_INCORRECT);
    }
    for (var key in CODEC_INFO) {
        if (has(CODEC_INFO, key) && !has(result.data, key)) {
            result.data[key] = CODEC_INFO[key];
        }
    }
    return result;
}

/* <addr16><value> records until the end of the payload. */
function decodeRecords(bytes, index, result) {
    while (index < bytes.length) {
        var key = registerKey(bytes, index);
        if (key === null) {
            addError(result, "Incomplete register address at index " + index);
            return;
        }
        if (!has(REGISTERS, key)) {
            addError(result, "Unknown register " + key + " at index " + index);
            return;
        }
        var decoded = decodeValue(bytes, index + 2, REGISTERS[key]);
        if (decoded === null) {
            addError(result, "Payload too short for register " + key + " at index " + index);
            return;
        }
        result.data[REGISTERS[key].NAME] = decoded.value;
        index = index + 2 + decoded.size;
    }
}

function decodeValue(bytes, index, reg) {
    var size = valueSize(bytes, index, reg);
    if (size < 0 || index + size > bytes.length) {
        return null;
    }
    var value;
    switch (reg.TYPE) {
    case "U8":
    case "U16":
    case "U32":
        value = scale(readUint(bytes, index, size), reg);
        break;
    case "I16":
        value = scale(readInt(bytes, index, size), reg);
        break;
    case "STR":
        value = readString(bytes, index + 1, bytes[index]);
        break;
    case "VER":
        value = "v" + bytes[index] + "." + bytes[index + 1];
        break;
    case "VER3":
        value = "v" + bytes[index] + "." + bytes[index + 1] + "." + bytes[index + 2];
        break;
    case "ENUM":
        value = enumLabel(reg.VALUES, bytes[index]);
        break;
    case "FLAGS":
        value = decodeFlags(readUint(bytes, index, size), reg.FLAGS);
        break;
    case "IP4":
        value = bytes[index] + "." + bytes[index + 1] + "." + bytes[index + 2] + "." + bytes[index + 3];
        break;
    default:
        return null;
    }
    return {value: value, size: size};
}

function valueSize(bytes, index, reg) {
    if (reg.TYPE === "STR") {
        return index < bytes.length ? 1 + bytes[index] : -1;
    }
    if (reg.TYPE === "FLAGS") {
        return reg.SIZE;
    }
    return has(TYPE_SIZES, reg.TYPE) ? TYPE_SIZES[reg.TYPE] : -1;
}

function decodeFlags(value, flags) {
    var decoded = {};
    for (var i = 0; i < flags.length; i = i + 1) {
        var bit = Math.floor(value / Math.pow(2, flags[i].BIT)) % 2;
        decoded[flags[i].NAME] = flags[i].VALUES[bit];
    }
    return decoded;
}

function enumLabel(values, raw) {
    return has(values, raw) ? values[raw] : "UNKNOWN (" + raw + ")";
}

function scale(raw, reg) {
    if (reg.RESOLUTION) {
        return round(raw * reg.RESOLUTION, reg.DECIMALS === undefined ? 3 : reg.DECIMALS);
    }
    return raw;
}

function round(value, decimals) {
    return parseFloat(value.toFixed(decimals));
}

/************************************************************************************************************/
/* Byte helpers (no DataView, typed arrays or 32-bit shifts on values above 2^31)                          */
/************************************************************************************************************/

function registerKey(bytes, index) {
    if (index + 2 > bytes.length) {
        return null;
    }
    return "0x" + byteToHex(bytes[index]) + byteToHex(bytes[index + 1]);
}

function byteToHex(value) {
    var hex = value.toString(16).toUpperCase();
    return hex.length === 1 ? "0" + hex : hex;
}

function readUint(bytes, index, size) {
    var value = 0;
    for (var i = 0; i < size; i = i + 1) {
        value = value * 256 + bytes[index + i];
    }
    return value;
}

function readInt(bytes, index, size) {
    var value = readUint(bytes, index, size);
    var range = Math.pow(2, 8 * size);
    return value >= range / 2 ? value - range : value;
}

function readString(bytes, index, length) {
    var text = "";
    for (var i = 0; i < length; i = i + 1) {
        text = text + String.fromCharCode(bytes[index + i]);
    }
    return text;
}

function writeUint(out, value, size) {
    for (var i = size - 1; i >= 0; i = i - 1) {
        out.push(Math.floor(value / Math.pow(2, 8 * i)) % 256);
    }
}

/************************************************************************************************************/
/* Downlink encoding                                                                                        */
/************************************************************************************************************/

/*
 * Commands (see IQ-UFC.txt for examples):
 *   {"fPort": 50, "Type": "Config", "Config": [{"Param": "heatingSetpoint", "Value": 21.5}]}
 *   {"fPort": 100, "Type": "Reading", "Reading": ["heatingSetpoint", "channel1OutputState"]}
 *   {"fPort": 1-10, "Type": "Periodic", "Periodic": {"UplinkInterval": 15, "Mode": 0, "Status": 1,
 *       "Registers": ["heatingSetpoint"]}}      (any subset of the four fields)
 * The firmware checks a whole Config downlink as one session: one refused value fails it all.
 */
function encodeCommand(fPort, command) {
    var result = {bytes: [], fPort: fPort, errors: [], warnings: []};
    if (!command || typeof command !== "object" || !has(command, "Type")) {
        addError(result, MESSAGES.CMD_INVALID + ": please add Type to the command");
    } else if (command.Type === "Config") {
        if (fPort !== FPORT.GENERIC) {
            addError(result, MESSAGES.CMD_FPORT_INVALID);
        } else {
            encodeConfig(command.Config, result);
        }
    } else if (command.Type === "Reading") {
        if (fPort !== FPORT.READING) {
            addError(result, MESSAGES.CMD_FPORT_INVALID);
        } else {
            encodeReading(command.Reading, result);
        }
    } else if (command.Type === "Periodic") {
        if (fPort < FPORT.PERIODIC_MIN || fPort > FPORT.PERIODIC_MAX) {
            addError(result, MESSAGES.CMD_FPORT_INVALID);
        } else {
            encodePeriodic(command.Periodic, result);
        }
    } else {
        addError(result, MESSAGES.CMD_INVALID + ": please check " + command.Type + " in the command");
    }
    if (result.errors.length === 0 && result.bytes.length > LIMITS.DOWNLINK_SIZE) {
        addError(result, MESSAGES.CMD_TOO_LONG + ": " + result.bytes.length + " bytes, the device accepts at most " +
            LIMITS.DOWNLINK_SIZE);
    }
    if (result.errors.length > 0) {
        result.bytes = [];
    }
    return result;
}

/* Any number of registers, as long as the downlink fits LIMITS.DOWNLINK_SIZE. */
function encodeConfig(list, result) {
    if (!isArray(list) || list.length < 1) {
        addError(result, MESSAGES.CMD_REGISTER_NUMBER_INVALID + ": please check Config in the command");
        return;
    }
    for (var i = 0; i < list.length; i = i + 1) {
        var item = list[i];
        if (!item || typeof item !== "object" || !has(item, "Param") || !has(item, "Value")) {
            addError(result, MESSAGES.CMD_INVALID + ": please add Param and Value to each object in the Config array");
            return;
        }
        var key = lookupRegister(item.Param, "W", result);
        if (key === null) {
            return;
        }
        var value = encodeValue(REGISTERS[key], item.Value);
        if (value === null) {
            addError(result, MESSAGES.CMD_DATA_INVALID + ": please check " + item.Param + " in the command");
            return;
        }
        writeUint(result.bytes, parseInt(key, 16), 2);
        for (var j = 0; j < value.length; j = j + 1) {
            result.bytes.push(value[j]);
        }
    }
}

function encodeReading(list, result) {
    if (!isArray(list) || list.length < 1 || list.length > LIMITS.COMMAND_REGISTERS) {
        addError(result, MESSAGES.CMD_REGISTER_NUMBER_INVALID + ": please check Reading in the command");
        return;
    }
    result.bytes.push(READING.CHANNEL);
    result.bytes.push(READING.TYPE);
    for (var i = 0; i < list.length; i = i + 1) {
        var key = lookupRegister(list[i], "R", result);
        if (key === null) {
            return;
        }
        writeUint(result.bytes, parseInt(key, 16), 2);
    }
}

/* Mode: 0 unconfirmed, 1 confirmed uplinks. Status: 0 inactive, 1 active. */
function encodePeriodic(config, result) {
    if (!config || typeof config !== "object") {
        addError(result, MESSAGES.CMD_INVALID + ": please add Periodic object to the command");
        return;
    }
    var fields = 0;
    if (has(config, "UplinkInterval")) {
        // Minutes; the firmware rejects 0.
        if (!isInterval(config.UplinkInterval)) {
            addError(result, MESSAGES.CMD_DATA_INVALID + ": please check UplinkInterval in the command");
            return;
        }
        result.bytes.push(PERIODIC.CHANNEL, PERIODIC.INTERVAL);
        writeUint(result.bytes, config.UplinkInterval, 2);
        fields = fields + 1;
    }
    if (has(config, "Mode")) {
        if (config.Mode !== 0 && config.Mode !== 1) {
            addError(result, MESSAGES.CMD_DATA_INVALID + ": please check Mode in the command");
            return;
        }
        result.bytes.push(PERIODIC.CHANNEL, PERIODIC.MODE, config.Mode);
        fields = fields + 1;
    }
    if (has(config, "Status")) {
        if (config.Status !== 0 && config.Status !== 1) {
            addError(result, MESSAGES.CMD_DATA_INVALID + ": please check Status in the command");
            return;
        }
        result.bytes.push(PERIODIC.CHANNEL, PERIODIC.STATUS, config.Status);
        fields = fields + 1;
    }
    if (has(config, "Registers")) {
        var list = config.Registers;
        if (!isArray(list) || list.length < 1 || list.length > LIMITS.COMMAND_REGISTERS) {
            addError(result, MESSAGES.CMD_REGISTER_NUMBER_INVALID + ": please check Registers in the command");
            return;
        }
        result.bytes.push(PERIODIC.CHANNEL, PERIODIC.REGISTERS, list.length * 2);
        for (var i = 0; i < list.length; i = i + 1) {
            var key = lookupRegister(list[i], "R", result);
            if (key === null) {
                return;
            }
            writeUint(result.bytes, parseInt(key, 16), 2);
        }
        fields = fields + 1;
    }
    if (fields === 0) {
        addError(result, MESSAGES.CMD_INVALID + ": please add UplinkInterval, Mode, Status or Registers");
    }
}

/* Interval in minutes: 1 to 65535. */
function isInterval(value) {
    return isInteger(value) && value >= 1 && value <= 0xFFFF;
}

/* @returns the register key, or null after adding an error */
function lookupRegister(name, access, result) {
    var keys = registerKeys();
    if (typeof name !== "string" || !has(keys, name)) {
        addError(result, MESSAGES.CMD_REGISTER_NOT_FOUND + ": please check " + name + " in the command");
        return null;
    }
    var key = keys[name];
    if (REGISTERS[key].RW.indexOf(access) < 0) {
        addError(result, (access === "W" ? MESSAGES.CMD_REGISTER_NOT_WRITABLE : MESSAGES.CMD_REGISTER_NOT_READABLE) +
            ": please check " + name + " in the command");
        return null;
    }
    return key;
}

/* @returns the value bytes, or null when the value is not acceptable */
function encodeValue(reg, value) {
    var out = [];
    if (reg.TYPE === "STR") {
        var minLength = reg.MIN === undefined ? 0 : reg.MIN;
        var maxLength = reg.MAX === undefined ? LIMITS.STRING_LENGTH : reg.MAX;
        if (typeof value !== "string" || value.length < minLength || value.length > maxLength) {
            return null;
        }
        out.push(value.length);
        for (var i = 0; i < value.length; i = i + 1) {
            if (value.charCodeAt(i) > 0x7F) {
                return null; // ASCII only
            }
            out.push(value.charCodeAt(i));
        }
        return out;
    }
    if (reg.TYPE === "IP4") {
        return encodeIp4(value);
    }
    if (reg.TYPE === "ENUM") {
        var raw = enumValue(reg.VALUES, value);
        if (raw === null || (reg.MIN !== undefined && raw < reg.MIN) || (reg.MAX !== undefined && raw > reg.MAX)) {
            return null;
        }
        out.push(raw);
        return out;
    }
    if (!has(TYPE_SIZES, reg.TYPE) || (reg.TYPE.charAt(0) !== "U" && reg.TYPE.charAt(0) !== "I")) {
        return null; // VER, VER3 and FLAGS registers are not writable
    }
    if (typeof value !== "number" || !isFinite(value) ||
            (reg.MIN !== undefined && value < reg.MIN) || (reg.MAX !== undefined && value > reg.MAX)) {
        return null;
    }
    var size = TYPE_SIZES[reg.TYPE];
    var number = reg.RESOLUTION ? Math.round(value / reg.RESOLUTION) : value;
    var range = Math.pow(2, 8 * size);
    var signed = reg.TYPE.charAt(0) === "I";
    if (!isInteger(number) || number < (signed ? -range / 2 : 0) || number > (signed ? range / 2 - 1 : range - 1)) {
        return null;
    }
    writeUint(out, number < 0 ? number + range : number, size);
    return out;
}

/* "192.168.1.100" -> [192, 168, 1, 100], first byte first; null when not four numbers 0 to 255. */
function encodeIp4(value) {
    if (typeof value !== "string") {
        return null;
    }
    var parts = value.split(".");
    if (parts.length !== 4) {
        return null;
    }
    var out = [];
    for (var i = 0; i < 4; i = i + 1) {
        if (!/^[0-9]{1,3}$/.test(parts[i])) {
            return null;
        }
        var number = parseInt(parts[i], 10);
        if (number > 255) {
            return null;
        }
        out.push(number);
    }
    return out;
}

/* ENUM writes accept the raw value (1) or its label ("ENABLED"). */
function enumValue(values, value) {
    if (typeof value === "number" && has(values, value)) {
        return value;
    }
    for (var raw in values) {
        if (has(values, raw) && values[raw] === value) {
            return parseInt(raw, 10);
        }
    }
    return null;
}

/************************************************************************************************************/
/* Shared helpers                                                                                           */
/************************************************************************************************************/

function registerKeys() {
    if (REGISTER_KEYS === null) {
        REGISTER_KEYS = indexRegisterNames(REGISTERS);
    }
    return REGISTER_KEYS;
}

function indexRegisterNames(registers) {
    var names = {};
    for (var key in registers) {
        if (has(registers, key)) {
            names[registers[key].NAME] = key;
        }
    }
    return names;
}

function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

// ChirpStack v3 (otto) passes the lists of the Encode() object as Go slices: they inherit
// Array.prototype, but Object.prototype.toString reports them as "[object GoArray]".
function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]" || value instanceof Array;
}

function isInteger(value) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
}

/* Errors mean "nothing decoded / nothing encoded": ChirpStack v4 drops an uplink whose errors array is not empty. */
function addError(result, message) {
    result.errors.push(message);
    if (result.data) {
        result.data.error = message;
    }
}

function addWarning(result, message) {
    result.warnings.push(message);
    if (result.data) {
        result.data.warning = message;
    }
}

/************************************************************************************************************/
/* Entry points                                                                                             */
/************************************************************************************************************/

// LoRa Alliance TS013: ChirpStack v4, TTN/TTI, LORIOT, ThingPark.
// input = {bytes: [..], fPort: n, recvTime: Date, variables: {..}}
function decodeUplink(input) {
    return decodePayload(input.fPort, input.bytes);
}

// input = {data: {fPort: n, Type: "...", ...}, variables: {..}}; without fPort, the command Type chooses it.
function encodeDownlink(input) {
    var command = input.data;
    var fPort = FPORT.GENERIC;
    if (command && command.fPort) {
        fPort = command.fPort;
    } else if (command && typeof command.Type === "string" && has(COMMAND_FPORTS, command.Type)) {
        fPort = COMMAND_FPORTS[command.Type];
    }
    return encodeCommand(fPort, command);
}

// ChirpStack v3 (otto): returns the decoded object.
function Decode(fPort, bytes, variables) {
    return decodePayload(fPort, bytes).data;
}

// ChirpStack v3 (otto): fPort is the downlink queue item's fPort; returns the byte array.
function Encode(fPort, obj, variables) {
    return encodeCommand(fPort, obj).bytes;
}
