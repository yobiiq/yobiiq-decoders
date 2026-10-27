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
 * @version     1.1.0
 * @copyright   YOBIIQ B.V. | https://www.yobiiq.com
 *
 * @release     24-08-2026
 * @update      15-10-2026
 *
 * @product     P1002003   IQ RCM (iQ Digital Controller)
 *
 * @firmware    IQ RCM v1.1.0
 *
 */


// Added to every decoded uplink, without overwriting decoded fields.
var CODEC_INFO = {
    codecVersion: "1.1.0",
    genericModel: "IQ RCM",
    productCode: "P1002003",
    manufacturer: "YOBIIQ B.V."
};

var FPORT = {
    MAC: 0,
    PERIODIC_MIN: 1,
    PERIODIC_MAX: 10,
    ALARM: 11,
    GENERIC: 50,
    READING: 100,
    FUOTA_MIN: 200,
    FUOTA_MAX: 202,
    FMP: 203
};

var MESSAGES = {
    MAC: "MAC COMMAND RECEIVED",
    FUOTA: "FUOTA DATA RECEIVED",
    FMP: "FIRMWARE MANAGEMENT DATA RECEIVED",
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
    COMMAND_REGISTERS: 10,      // registers per Config, Reading or Periodic command
    STRING_LENGTH: 15,          // firmware rejects strings longer than 15 characters
    DOWNLINK_SIZE: 64           // firmware drops longer downlinks without a status uplink
};

var OFF_ON = {0: "OFF", 1: "ON"};
var DISABLED_ENABLED = {0: "DISABLED", 1: "ENABLED"};
var INVALID_VALID = {0: "INVALID", 1: "VALID"};
var CONTROL_MODE_VALUES = {0: "NORMAL", 1: "MANUAL_ON", 2: "MANUAL_OFF"};
var DESIRED_STATE_VALUES = {0: "AUTO", 1: "ON_BY_DL", 2: "OFF_BY_DL", 3: "ON_BY_BLE", 4: "OFF_BY_BLE"};
var RELAY_REASON_VALUES = {0: "DEFAULT", 1: "DOWNLINK", 2: "BLE", 3: "WEEK_TIMER", 4: "MANUAL", 5: "MOMENTARY",
    6: "PROTECTION", 7: "WATCHDOG"};
var PROTECTION_TRIP_VALUES = {0: "NONE", 1: "OVERHEAT", 2: "VOLTAGE", 3: "CURRENT", 4: "PREPAID"};

/* Relay state info: 4 bytes relay state, control mode, reason, active protection trip. */
function decodeRelayStateInfo(bytes, index) {
    return {
        state: enumLabel(OFF_ON, bytes[index]),
        controlMode: enumLabel(CONTROL_MODE_VALUES, bytes[index + 1]),
        reason: enumLabel(RELAY_REASON_VALUES, bytes[index + 2]),
        protectionTrip: enumLabel(PROTECTION_TRIP_VALUES, bytes[index + 3])
    };
}

/* Relay change of state alarm: relay state info before, then after the change. */
function decodeRelayChangeOfState(bytes, index) {
    return {
        previous: decodeRelayStateInfo(bytes, index),
        current: decodeRelayStateInfo(bytes, index + 4)
    };
}

/*
 * Register table: one entry per register address, used to decode uplinks AND
 * to encode downlinks, so the two directions can never disagree on an address.
 *
 *   NAME        key in the decoded object, Param / Registers name in commands
 *   TYPE        U8 U16 U24 U32 I8 I16 I32 F32 F64 STR VER VER3 ENUM FLAGS STRUCT
 *   RW          what the firmware accepts over LoRaWAN: "R", "W", "RW" or "" (uplink only)
 *   RESOLUTION  decoded value = raw * RESOLUTION (and raw = value / RESOLUTION when encoding)
 *   DECIMALS    rounding of scaled and float values (default 3, F64 default 6)
 *   VALUES      ENUM labels by raw value; unknown values decode as "UNKNOWN (<raw>)"
 *   FLAGS       FLAGS bits: [{NAME: ..., BIT: n, VALUES: [label when 0, label when 1]}]
 *   SIZE        byte size of FLAGS and STRUCT registers
 *   DECODE      STRUCT decoder: function (bytes, index) returning the decoded value
 *   MIN, MAX    accepted range of written values (in decoded units; ENUM: raw values); STR: MAX length
 *   ALLOWED     list of the only accepted written values (for example serial baud rates)
 */
var REGISTERS = {

    /* Uplink header of periodic, alarm and max demand uplinks (not a register) */
    "0xFF01": {NAME: "dataloggerTimestamp", TYPE: "U32", RW: ""},

    /* Generic registers, common to every YOBIIQ SDK device */
    "0xFF32": {NAME: "buildingName", TYPE: "STR", RW: "RW"},
    "0xFF33": {NAME: "buildingRoom", TYPE: "STR", RW: "RW"},
    "0xFF34": {NAME: "deviceName", TYPE: "STR", RW: "RW"},
    "0xFF64": {NAME: "deviceStatus", TYPE: "ENUM", RW: "R", VALUES: {0: "NORMAL_MODE", 1: "SPECIAL_MODE"}},
    "0xFF65": {NAME: "manufacturer", TYPE: "STR", RW: "R"},
    "0xFF66": {NAME: "originalEquipmentManufacturer", TYPE: "STR", RW: "R"},
    "0xFF67": {NAME: "deviceModel", TYPE: "STR", RW: "R"},
    "0xFF68": {NAME: "deviceSerialNumber", TYPE: "U32", RW: "R"},
    "0xFF69": {NAME: "firmwareVersion", TYPE: "VER", RW: "R"},
    "0xFF6A": {NAME: "hardwareVersion", TYPE: "VER", RW: "R"},
    "0xFF6B": {NAME: "externalPowerStatus", TYPE: "ENUM", RW: "R", VALUES: {0: "BATTERY_POWER", 1: "MAINS_POWER"}},
    "0xFF6C": {NAME: "batteryVoltage", TYPE: "U8", RW: "R", RESOLUTION: 0.1, DECIMALS: 1},
    "0xFF6D": {NAME: "batteryPercentage", TYPE: "U8", RW: "R"},
    "0xFF6F": {NAME: "rebootDevice", TYPE: "U8", RW: "W", MIN: 1, MAX: 1},
    "0xFF78": {NAME: "internalCircuitTemperatureAlarm", TYPE: "ENUM", RW: "R", VALUES: {0: "NORMAL", 1: "ALARM"}},
    "0xFF79": {NAME: "internalCircuitTemperatureNumberOfAlarms", TYPE: "U32", RW: "R"},
    "0xFF7A": {NAME: "internalCircuitTemperature", TYPE: "I16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0xFF7B": {NAME: "internalCircuitHumidity", TYPE: "U8", RW: "R"},
    "0xFF82": {NAME: "ambientTemperature", TYPE: "I16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0xFF83": {NAME: "ambientHumidity", TYPE: "U8", RW: "R"},
    "0xFF95": {NAME: "restartLoRaWAN", TYPE: "U8", RW: "W", MIN: 1, MAX: 1},
    "0xFF96": {NAME: "joinStatus", TYPE: "ENUM", RW: "R", VALUES: {0: "OFFLINE", 1: "ONLINE"}},
    "0xFF97": {NAME: "radioModule", TYPE: "STR", RW: "R"},
    "0xFF98": {NAME: "lorawanRegion", TYPE: "ENUM", RW: "R", VALUES: {1: "EU868", 2: "AS923-1", 3: "US915",
        4: "AU915", 5: "CN470", 6: "WW2G4", 7: "AS923-2", 8: "AS923-3", 9: "IN865", 10: "KR920", 11: "RU864",
        12: "CN470-RP1.0", 13: "AS923-4"}},
    "0xFF99": {NAME: "lorawanVersion", TYPE: "VER3", RW: "R"},
    "0xFF9D": {NAME: "applicationPort", TYPE: "U8", RW: "R"},
    "0xFF9E": {NAME: "joinType", TYPE: "ENUM", RW: "R", VALUES: {1: "OTAA"}},
    "0xFF9F": {NAME: "deviceClass", TYPE: "ENUM", RW: "RW", VALUES: {0: "CLASS_A", 1: "CLASS_B", 2: "CLASS_C"}},
    "0xFFA0": {NAME: "adr", TYPE: "ENUM", RW: "RW", VALUES: {0: "DISABLED", 1: "ENABLED"}},
    "0xFFA1": {NAME: "sf", TYPE: "ENUM", RW: "RW", VALUES: {0: "SF12BW125", 1: "SF11BW125", 2: "SF10BW125",
        3: "SF9BW125", 4: "SF8BW125", 5: "SF7BW125", 6: "SF7BW250"}},
    "0xFFA2": {NAME: "adrProfile", TYPE: "ENUM", RW: "RW", VALUES: {0: "NETWORK_CONTROLLED",
        1: "MOBILE_LONG_RANGE", 2: "MOBILE_LOW_POWER"}},
    "0xFFA3": {NAME: "radioMode", TYPE: "ENUM", RW: "RW", VALUES: {0: "LORAWAN", 1: "IQ_D2D",
        2: "LORAWAN_AND_IQ_D2D"}},
    "0xFFA4": {NAME: "numberOfJoinAttempts", TYPE: "U8", RW: "RW"},
    "0xFFA5": {NAME: "linkCheckTimeframe", TYPE: "U16", RW: "RW", MIN: 1},
    "0xFFA6": {NAME: "dataRetransmission", TYPE: "ENUM", RW: "RW", VALUES: {0: "DISABLED", 1: "ENABLED"}},
    "0xFFA7": {NAME: "lorawanWatchdogAlarm", TYPE: "ENUM", RW: "R", VALUES: {0: "NORMAL", 1: "ALARM"}},

    /* Global relay settings */
    "0x00EC": {NAME: "overheatThreshold", TYPE: "U8", RW: "RW", MIN: 1, MAX: 75},
    "0x00ED": {NAME: "protectionDelay", TYPE: "U16", RW: "RW", MIN: 1, MAX: 600},
    // LoRaWAN watchdog: relays to their initial state as soon as the network is lost, until the next join
    "0x00EE": {NAME: "watchdog", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Channel 1 */
    "0x0100": {NAME: "channel1ControlMode", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 0, VALUES: CONTROL_MODE_VALUES},
    "0x0101": {NAME: "channel1InitialState", TYPE: "ENUM", RW: "RW", VALUES: OFF_ON},
    "0x0102": {NAME: "channel1WeekTimer", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0103": {NAME: "channel1WeekTimerScheduleValidity", TYPE: "ENUM", RW: "R", VALUES: INVALID_VALID},
    "0x0104": {NAME: "channel1DesiredState", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 2, VALUES: DESIRED_STATE_VALUES},
    "0x0105": {NAME: "channel1BleControl", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0106": {NAME: "channel1VoltageProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0107": {NAME: "channel1VoltageHighLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0x0108": {NAME: "channel1VoltageLowLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0x0109": {NAME: "channel1CurrentProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x010A": {NAME: "channel1CurrentLimit", TYPE: "U16", RW: "RW", MIN: 1, MAX: 20},
    "0x010B": {NAME: "channel1ConsumptionCumulative", TYPE: "U32", RW: "R"},
    "0x010C": {NAME: "channel1ConsumptionCurrentUser", TYPE: "U32", RW: "RW", MIN: 0, MAX: 0},
    "0x010D": {NAME: "channel1Prepaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x010E": {NAME: "channel1AllowedConsumption", TYPE: "U32", RW: "RW"},
    "0x010F": {NAME: "channel1Postpaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0110": {NAME: "channel1MomentaryDuration", TYPE: "U8", RW: "RW", MIN: 1, MAX: 120},
    "0x0111": {NAME: "channel1MomentaryRequestId", TYPE: "U8", RW: "RW"},
    "0x0112": {NAME: "channel1OnOffCycles", TYPE: "U32", RW: "R"},
    "0x0113": {NAME: "channel1RelayStateInfo", TYPE: "STRUCT", RW: "R", SIZE: 4, DECODE: decodeRelayStateInfo},
    "0x0114": {NAME: "channel1RelayChangeOfState", TYPE: "STRUCT", RW: "", SIZE: 8, DECODE: decodeRelayChangeOfState},

    /* Channel 2 */
    "0x0200": {NAME: "channel2ControlMode", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 0, VALUES: CONTROL_MODE_VALUES},
    "0x0201": {NAME: "channel2InitialState", TYPE: "ENUM", RW: "RW", VALUES: OFF_ON},
    "0x0202": {NAME: "channel2WeekTimer", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0203": {NAME: "channel2WeekTimerScheduleValidity", TYPE: "ENUM", RW: "R", VALUES: INVALID_VALID},
    "0x0204": {NAME: "channel2DesiredState", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 2, VALUES: DESIRED_STATE_VALUES},
    "0x0205": {NAME: "channel2BleControl", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0206": {NAME: "channel2VoltageProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0207": {NAME: "channel2VoltageHighLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0x0208": {NAME: "channel2VoltageLowLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0x0209": {NAME: "channel2CurrentProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x020A": {NAME: "channel2CurrentLimit", TYPE: "U16", RW: "RW", MIN: 1, MAX: 20},
    "0x020B": {NAME: "channel2ConsumptionCumulative", TYPE: "U32", RW: "R"},
    "0x020C": {NAME: "channel2ConsumptionCurrentUser", TYPE: "U32", RW: "RW", MIN: 0, MAX: 0},
    "0x020D": {NAME: "channel2Prepaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x020E": {NAME: "channel2AllowedConsumption", TYPE: "U32", RW: "RW"},
    "0x020F": {NAME: "channel2Postpaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0x0210": {NAME: "channel2MomentaryDuration", TYPE: "U8", RW: "RW", MIN: 1, MAX: 120},
    "0x0211": {NAME: "channel2MomentaryRequestId", TYPE: "U8", RW: "RW"},
    "0x0212": {NAME: "channel2OnOffCycles", TYPE: "U32", RW: "R"},
    "0x0213": {NAME: "channel2RelayStateInfo", TYPE: "STRUCT", RW: "R", SIZE: 4, DECODE: decodeRelayStateInfo},
    "0x0214": {NAME: "channel2RelayChangeOfState", TYPE: "STRUCT", RW: "", SIZE: 8, DECODE: decodeRelayChangeOfState},

    /* Channel 1 week timer (minute of the day, Monday first) */
    "0xC100": {NAME: "channel1MondayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC101": {NAME: "channel1MondayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC102": {NAME: "channel1MondayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC103": {NAME: "channel1MondayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC104": {NAME: "channel1MondayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC105": {NAME: "channel1MondayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC106": {NAME: "channel1MondayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC107": {NAME: "channel1MondayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC108": {NAME: "channel1TuesdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC109": {NAME: "channel1TuesdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC10A": {NAME: "channel1TuesdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC10B": {NAME: "channel1TuesdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC10C": {NAME: "channel1TuesdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC10D": {NAME: "channel1TuesdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC10E": {NAME: "channel1TuesdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC10F": {NAME: "channel1TuesdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC110": {NAME: "channel1WednesdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC111": {NAME: "channel1WednesdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC112": {NAME: "channel1WednesdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC113": {NAME: "channel1WednesdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC114": {NAME: "channel1WednesdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC115": {NAME: "channel1WednesdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC116": {NAME: "channel1WednesdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC117": {NAME: "channel1WednesdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC118": {NAME: "channel1ThursdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC119": {NAME: "channel1ThursdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC11A": {NAME: "channel1ThursdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC11B": {NAME: "channel1ThursdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC11C": {NAME: "channel1ThursdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC11D": {NAME: "channel1ThursdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC11E": {NAME: "channel1ThursdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC11F": {NAME: "channel1ThursdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC120": {NAME: "channel1FridayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC121": {NAME: "channel1FridayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC122": {NAME: "channel1FridayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC123": {NAME: "channel1FridayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC124": {NAME: "channel1FridayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC125": {NAME: "channel1FridayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC126": {NAME: "channel1FridayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC127": {NAME: "channel1FridayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC128": {NAME: "channel1SaturdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC129": {NAME: "channel1SaturdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC12A": {NAME: "channel1SaturdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC12B": {NAME: "channel1SaturdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC12C": {NAME: "channel1SaturdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC12D": {NAME: "channel1SaturdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC12E": {NAME: "channel1SaturdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC12F": {NAME: "channel1SaturdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC130": {NAME: "channel1SundayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC131": {NAME: "channel1SundayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC132": {NAME: "channel1SundayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC133": {NAME: "channel1SundayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC134": {NAME: "channel1SundayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC135": {NAME: "channel1SundayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC136": {NAME: "channel1SundayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC137": {NAME: "channel1SundayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},

    /* Channel 2 week timer (minute of the day, Monday first) */
    "0xC200": {NAME: "channel2MondayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC201": {NAME: "channel2MondayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC202": {NAME: "channel2MondayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC203": {NAME: "channel2MondayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC204": {NAME: "channel2MondayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC205": {NAME: "channel2MondayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC206": {NAME: "channel2MondayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC207": {NAME: "channel2MondayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC208": {NAME: "channel2TuesdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC209": {NAME: "channel2TuesdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC20A": {NAME: "channel2TuesdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC20B": {NAME: "channel2TuesdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC20C": {NAME: "channel2TuesdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC20D": {NAME: "channel2TuesdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC20E": {NAME: "channel2TuesdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC20F": {NAME: "channel2TuesdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC210": {NAME: "channel2WednesdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC211": {NAME: "channel2WednesdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC212": {NAME: "channel2WednesdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC213": {NAME: "channel2WednesdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC214": {NAME: "channel2WednesdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC215": {NAME: "channel2WednesdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC216": {NAME: "channel2WednesdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC217": {NAME: "channel2WednesdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC218": {NAME: "channel2ThursdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC219": {NAME: "channel2ThursdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC21A": {NAME: "channel2ThursdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC21B": {NAME: "channel2ThursdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC21C": {NAME: "channel2ThursdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC21D": {NAME: "channel2ThursdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC21E": {NAME: "channel2ThursdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC21F": {NAME: "channel2ThursdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC220": {NAME: "channel2FridayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC221": {NAME: "channel2FridayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC222": {NAME: "channel2FridayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC223": {NAME: "channel2FridayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC224": {NAME: "channel2FridayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC225": {NAME: "channel2FridayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC226": {NAME: "channel2FridayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC227": {NAME: "channel2FridayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC228": {NAME: "channel2SaturdayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC229": {NAME: "channel2SaturdayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC22A": {NAME: "channel2SaturdayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC22B": {NAME: "channel2SaturdayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC22C": {NAME: "channel2SaturdayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC22D": {NAME: "channel2SaturdayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC22E": {NAME: "channel2SaturdayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC22F": {NAME: "channel2SaturdayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC230": {NAME: "channel2SundayWindow1StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC231": {NAME: "channel2SundayWindow1EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC232": {NAME: "channel2SundayWindow2StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC233": {NAME: "channel2SundayWindow2EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC234": {NAME: "channel2SundayWindow3StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC235": {NAME: "channel2SundayWindow3EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC236": {NAME: "channel2SundayWindow4StartMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440},
    "0xC237": {NAME: "channel2SundayWindow4EndMinute", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1440}
};

var TYPE_SIZES = {U8: 1, U16: 2, U24: 3, U32: 4, I8: 1, I16: 2, I32: 4, F32: 4, F64: 8, VER: 2, VER3: 3, ENUM: 1};

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
    } else if (fPort >= FPORT.FUOTA_MIN && fPort <= FPORT.FUOTA_MAX) {
        result.data.info = MESSAGES.FUOTA;
    } else if (fPort === FPORT.FMP) {
        decodeFmpAnswers(bytes, result);
        result.data.info = MESSAGES.FMP;
    } else if (bytes.length === 1 && (bytes[0] === 0 || bytes[0] === 1)) {
        // One byte status reply to a downlink, on the fPort of the command.
        if (bytes[0] === 0) {
            result.data.info = MESSAGES.DOWNLINK_SUCCESS;
        } else {
            addWarning(result, MESSAGES.DOWNLINK_FAILURE);
        }
    } else if ((fPort >= FPORT.PERIODIC_MIN && fPort <= FPORT.PERIODIC_MAX) || fPort === FPORT.ALARM ||
            fPort === FPORT.GENERIC || fPort === FPORT.READING) {
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

/* LoRa Alliance FUOTA firmware management (FMP) answers, little endian. */
function decodeFmpAnswers(bytes, result) {
    var index = 0;
    while (index < bytes.length) {
        var cid = bytes[index];
        index = index + 1;
        if (cid === 0 && index + 2 <= bytes.length) {
            result.data.fmpPackageVersionAns = {id: bytes[index], version: bytes[index + 1]};
            index = index + 2;
        } else if (cid === 1 && index + 8 <= bytes.length) {
            result.data.fmpDevVersionAns = {
                firmware: fmpVersion(bytes, index),
                hardware: fmpVersion(bytes, index + 4)
            };
            index = index + 8;
        } else if (cid === 2 && index + 4 <= bytes.length) {
            result.data.fmpDevRebootTimeAns = readUintLE(bytes, index, 4);
            index = index + 4;
        } else if (cid === 3 && index + 3 <= bytes.length) {
            result.data.fmpDevRebootCountdownAns = readUintLE(bytes, index, 3);
            index = index + 3;
        } else if (cid === 4 && index + 1 <= bytes.length) {
            var status = bytes[index];
            var answer = {};
            index = index + 1;
            if (status === 3 && index + 4 <= bytes.length) {
                answer = fmpVersion(bytes, index);
                index = index + 4;
            }
            answer.status = enumLabel({0: "NO_FIRMWARE_UPGRADE_IMAGE", 1: "FIRMWARE_UPGRADE_IMAGE_INVALID",
                2: "FIRMWARE_UPGRADE_IMAGE_MISMATCH", 3: "FIRMWARE_UPGRADE_IMAGE_VALID"}, status);
            result.data.fmpDevUpgradeImageAns = answer;
        } else if (cid === 5 && index + 1 <= bytes.length) {
            result.data.fmpDevDeleteImageAns = {
                status: bytes[index],
                meaning: bytes[index] === 0 ? "DELETE_IMAGE_SUCCESS" : "DELETE_IMAGE_FAILED"
            };
            index = index + 1;
        } else {
            return;
        }
    }
}

/* major << 24 | minor << 16 | revision, little endian on air */
function fmpVersion(bytes, index) {
    var answer = {
        major: bytes[index + 3],
        minor: bytes[index + 2],
        revision: readUintLE(bytes, index, 2)
    };
    answer.version = "v" + answer.major + "." + answer.minor + "." + answer.revision;
    return answer;
}

/* @returns {value, size} or null when the payload is too short */
function decodeValue(bytes, index, reg) {
    var size = valueSize(bytes, index, reg);
    if (size < 0 || index + size > bytes.length) {
        return null;
    }
    var value;
    switch (reg.TYPE) {
    case "U8":
    case "U16":
    case "U24":
    case "U32":
        value = scale(readUint(bytes, index, size), reg);
        break;
    case "I8":
    case "I16":
    case "I32":
        value = scale(readInt(bytes, index, size), reg);
        break;
    case "F32":
        value = scaleFloat(readFloat32(bytes, index), reg, 3);
        break;
    case "F64":
        value = scaleFloat(readFloat64(bytes, index), reg, 6);
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
    case "STRUCT":
        value = reg.DECODE(bytes, index);
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
    if (reg.TYPE === "FLAGS" || reg.TYPE === "STRUCT") {
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

/* NaN and infinities (meter read errors) decode as null. */
function scaleFloat(raw, reg, defaultDecimals) {
    if (raw === null) {
        return null;
    }
    if (reg.RESOLUTION) {
        raw = raw * reg.RESOLUTION;
    }
    return round(raw, reg.DECIMALS === undefined ? defaultDecimals : reg.DECIMALS);
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

function readUintLE(bytes, index, size) {
    var value = 0;
    for (var i = size - 1; i >= 0; i = i - 1) {
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

/* IEEE 754 single precision, big endian. */
function readFloat32(bytes, index) {
    var bits = readUint(bytes, index, 4);
    var sign = bits >= 0x80000000 ? -1 : 1;
    var exponent = Math.floor(bits / 0x800000) % 0x100;
    var mantissa = bits % 0x800000;
    if (exponent === 0xFF) {
        return null;
    }
    if (exponent === 0) {
        return sign * mantissa * Math.pow(2, -149);
    }
    return sign * (1 + mantissa / 0x800000) * Math.pow(2, exponent - 127);
}

/* IEEE 754 double precision, big endian. */
function readFloat64(bytes, index) {
    var high = readUint(bytes, index, 4);
    var low = readUint(bytes, index + 4, 4);
    var sign = high >= 0x80000000 ? -1 : 1;
    var exponent = Math.floor(high / 0x100000) % 0x800;
    var mantissa = (high % 0x100000) * 0x100000000 + low;
    if (exponent === 0x7FF) {
        return null;
    }
    if (exponent === 0) {
        return sign * mantissa * Math.pow(2, -1074);
    }
    return sign * (1 + mantissa / Math.pow(2, 52)) * Math.pow(2, exponent - 1023);
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
 * Commands (see IQ-RCM.txt for examples):
 *   {"fPort": 50, "Type": "Config", "Config": [{"Param": "adr", "Value": 1}]}
 *   {"fPort": 100, "Type": "Reading", "Reading": ["adr", "sf"]}
 *   {"fPort": 1-10, "Type": "Periodic", "Periodic": {"UplinkInterval": 15, "Mode": 0, "Status": 1,
 *       "Registers": ["channel1RelayStateInfo"]}}      (any subset of the four fields)
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

function encodeConfig(list, result) {
    if (!isArray(list) || list.length < 1 || list.length > LIMITS.COMMAND_REGISTERS) {
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
        var maxLength = reg.MAX === undefined ? LIMITS.STRING_LENGTH : reg.MAX;
        if (typeof value !== "string" || value.length > maxLength) {
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
    if (reg.TYPE === "ENUM") {
        var raw = enumValue(reg.VALUES, value);
        if (raw === null || (reg.MIN !== undefined && raw < reg.MIN) || (reg.MAX !== undefined && raw > reg.MAX)) {
            return null;
        }
        out.push(raw);
        return out;
    }
    if (!has(TYPE_SIZES, reg.TYPE) || (reg.TYPE.charAt(0) !== "U" && reg.TYPE.charAt(0) !== "I")) {
        return null; // F32, F64, VER, VER3, FLAGS and STRUCT registers are not writable here
    }
    if (typeof value !== "number" || !isFinite(value) ||
            (reg.MIN !== undefined && value < reg.MIN) || (reg.MAX !== undefined && value > reg.MAX) ||
            (reg.ALLOWED !== undefined && !contains(reg.ALLOWED, value))) {
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

function contains(list, value) {
    for (var i = 0; i < list.length; i = i + 1) {
        if (list[i] === value) {
            return true;
        }
    }
    return false;
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
