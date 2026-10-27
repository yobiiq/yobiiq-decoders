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
 * @version     1.2.0
 * @copyright   YOBIIQ B.V. | https://www.yobiiq.com
 *
 * @release     16-07-2026
 * @update      08-10-2026
 *
 * @product     26000x   IQ DEM (compatible with DEM1, DEM2 and DEM4 models)
 *
 * @firmware    IQ DEM v1.2.0
 *
 */


// Added to every decoded uplink, without overwriting decoded fields.
var CODEC_INFO = {
    codecVersion: "1.2.0",
    genericModel: "IQ DEM",
    productCode: "26000x",
    manufacturer: "YOBIIQ B.V."
};

var FPORT = {
    MAC: 0,
    PERIODIC_MIN: 1,
    PERIODIC_MAX: 10,
    ALARM: 11,
    MAX_DEMAND_CONFIG: 11,
    MAX_DEMAND: 20,
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

// Sources 0 to 5 are the meter sources (5: the app switches digital output 2, meter Remote Control);
// 6 and 7 are relay logic features of the app that also drive digital output 2 in Remote Control.
var DIGITAL_OUTPUT_SOURCE_VALUES = {0: "DISABLED", 1: "IMPORT_ACTIVE_ENERGY", 2: "EXPORT_ACTIVE_ENERGY",
    3: "IMPORT_REACTIVE_ENERGY", 4: "EXPORT_REACTIVE_ENERGY", 5: "REMOTE", 6: "INSTANTANEOUS_CURRENT", 7: "VOLTAGE"};
var DIGITAL_OUTPUT_MODE_VALUES = {0: "ENERGY", 1: "ALARM"};
var DIGITAL_OUTPUT_MULTIPLIER_VALUES = {0: "x0.001", 1: "x0.01", 2: "x0.1", 3: "x1", 4: "x10", 5: "x100", 6: "x1000"};
var DIGITAL_INPUT_SOURCE_VALUES = {0: "COUNTER", 1: "TARIFF"};
var DIGITAL_INPUT_EDGE_VALUES = {0: "RISING", 1: "FALLING", 2: "BOTH"};
var DEMAND_METHOD_VALUES = {0: "FIXED", 1: "SLIDING", 2: "ROLLING"};

var NORMAL_ALARM = {0: "NORMAL", 1: "ALARM"};
var SERIAL_PARITY_VALUES = {0: "NONE", 1: "ODD", 2: "EVEN"};
var SERIAL_BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

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
 *   MAX_DEMAND  true for the registers a MaxDemand command may select
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

    /* Measurements, float32 unless noted */
    "0x0000": {NAME: "frequency", TYPE: "F32", RW: "R"},
    "0x0010": {NAME: "phaseSequence", TYPE: "I32", RW: "R"},
    "0x0100": {NAME: "voltageAvgLN", TYPE: "F32", RW: "R"},
    "0x0101": {NAME: "voltageL1N", TYPE: "F32", RW: "R"},
    "0x0102": {NAME: "voltageL2N", TYPE: "F32", RW: "R"},
    "0x0103": {NAME: "voltageL3N", TYPE: "F32", RW: "R"},
    "0x0104": {NAME: "voltageL1L2", TYPE: "F32", RW: "R"},
    "0x0105": {NAME: "voltageL2L3", TYPE: "F32", RW: "R"},
    "0x0106": {NAME: "voltageL3L1", TYPE: "F32", RW: "R"},
    "0x0107": {NAME: "voltageAvgLL", TYPE: "F32", RW: "R"},
    "0x0111": {NAME: "voltageThdL1", TYPE: "F32", RW: "R"},
    "0x0112": {NAME: "voltageThdL2", TYPE: "F32", RW: "R"},
    "0x0113": {NAME: "voltageThdL3", TYPE: "F32", RW: "R"},
    "0x0200": {NAME: "currentTotal", TYPE: "F32", RW: "R"},
    "0x0201": {NAME: "currentL1", TYPE: "F32", RW: "R"},
    "0x0202": {NAME: "currentL2", TYPE: "F32", RW: "R"},
    "0x0203": {NAME: "currentL3", TYPE: "F32", RW: "R"},
    "0x0204": {NAME: "currentNeutral", TYPE: "F32", RW: "R"},
    "0x0211": {NAME: "currentThdL1", TYPE: "F32", RW: "R"},
    "0x0212": {NAME: "currentThdL2", TYPE: "F32", RW: "R"},
    "0x0213": {NAME: "currentThdL3", TYPE: "F32", RW: "R"},
    "0x0220": {NAME: "currentAvg", TYPE: "F32", RW: "R"},
    "0x0221": {NAME: "currentAvgL1", TYPE: "F32", RW: "R"},
    "0x0222": {NAME: "currentAvgL2", TYPE: "F32", RW: "R"},
    "0x0223": {NAME: "currentAvgL3", TYPE: "F32", RW: "R"},
    "0x02D0": {NAME: "currentDemandTotal", TYPE: "F32", RW: "R"},
    "0x02D1": {NAME: "currentDemandL1", TYPE: "F32", RW: "R"},
    "0x02D2": {NAME: "currentDemandL2", TYPE: "F32", RW: "R"},
    "0x02D3": {NAME: "currentDemandL3", TYPE: "F32", RW: "R"},
    "0x02E0": {NAME: "currentMaxDemandTotal", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x02E1": {NAME: "currentMaxDemandL1", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x02E2": {NAME: "currentMaxDemandL2", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x02E3": {NAME: "currentMaxDemandL3", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x0300": {NAME: "activePowerTotal", TYPE: "F32", RW: "R"},
    "0x0301": {NAME: "activePowerL1", TYPE: "F32", RW: "R"},
    "0x0302": {NAME: "activePowerL2", TYPE: "F32", RW: "R"},
    "0x0303": {NAME: "activePowerL3", TYPE: "F32", RW: "R"},
    "0x0310": {NAME: "activePowerImportDemand", TYPE: "F32", RW: "R"},
    "0x0320": {NAME: "activePowerExportDemand", TYPE: "F32", RW: "R"},
    "0x0330": {NAME: "activePowerImportMaxDemand", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x0340": {NAME: "activePowerExportMaxDemand", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x0350": {NAME: "reactivePowerTotal", TYPE: "F32", RW: "R"},
    "0x0351": {NAME: "reactivePowerL1", TYPE: "F32", RW: "R"},
    "0x0352": {NAME: "reactivePowerL2", TYPE: "F32", RW: "R"},
    "0x0353": {NAME: "reactivePowerL3", TYPE: "F32", RW: "R"},
    "0x0360": {NAME: "reactivePowerImportDemand", TYPE: "F32", RW: "R"},
    "0x0370": {NAME: "reactivePowerExportDemand", TYPE: "F32", RW: "R"},
    "0x0380": {NAME: "reactivePowerImportMaxDemand", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x0390": {NAME: "reactivePowerExportMaxDemand", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x03A0": {NAME: "apparentPowerTotal", TYPE: "F32", RW: "R"},
    "0x03A1": {NAME: "apparentPowerL1", TYPE: "F32", RW: "R"},
    "0x03A2": {NAME: "apparentPowerL2", TYPE: "F32", RW: "R"},
    "0x03A3": {NAME: "apparentPowerL3", TYPE: "F32", RW: "R"},
    "0x03B0": {NAME: "apparentPowerDemand", TYPE: "F32", RW: "R"},
    "0x03C0": {NAME: "apparentPowerMaxDemand", TYPE: "F32", RW: "R", MAX_DEMAND: true},
    "0x03D1": {NAME: "phaseAngleL1", TYPE: "F32", RW: "R"},
    "0x03D2": {NAME: "phaseAngleL2", TYPE: "F32", RW: "R"},
    "0x03D3": {NAME: "phaseAngleL3", TYPE: "F32", RW: "R"},
    "0x03E1": {NAME: "cosPhiL1", TYPE: "F32", RW: "R"},
    "0x03E2": {NAME: "cosPhiL2", TYPE: "F32", RW: "R"},
    "0x03E3": {NAME: "cosPhiL3", TYPE: "F32", RW: "R"},
    "0x03F0": {NAME: "powerFactorSystem", TYPE: "F32", RW: "R"},
    "0x03F1": {NAME: "powerFactorL1", TYPE: "F32", RW: "R"},
    "0x03F2": {NAME: "powerFactorL2", TYPE: "F32", RW: "R"},
    "0x03F3": {NAME: "powerFactorL3", TYPE: "F32", RW: "R"},

    /* Energies, float64 (kWh, kVArh) */
    "0x0400": {NAME: "importActiveEnergySystem", TYPE: "F64", RW: "R"},
    "0x0401": {NAME: "importActiveEnergyL1", TYPE: "F64", RW: "R"},
    "0x0402": {NAME: "importActiveEnergyL2", TYPE: "F64", RW: "R"},
    "0x0403": {NAME: "importActiveEnergyL3", TYPE: "F64", RW: "R"},
    "0x0410": {NAME: "importActiveEnergySystemT1", TYPE: "F64", RW: "R"},
    "0x0411": {NAME: "importActiveEnergyL1T1", TYPE: "F64", RW: "R"},
    "0x0412": {NAME: "importActiveEnergyL2T1", TYPE: "F64", RW: "R"},
    "0x0413": {NAME: "importActiveEnergyL3T1", TYPE: "F64", RW: "R"},
    "0x0420": {NAME: "importActiveEnergySystemT2", TYPE: "F64", RW: "R"},
    "0x0421": {NAME: "importActiveEnergyL1T2", TYPE: "F64", RW: "R"},
    "0x0422": {NAME: "importActiveEnergyL2T2", TYPE: "F64", RW: "R"},
    "0x0423": {NAME: "importActiveEnergyL3T2", TYPE: "F64", RW: "R"},
    "0x0430": {NAME: "importActiveEnergySystemT3", TYPE: "F64", RW: "R"},
    "0x0431": {NAME: "importActiveEnergyL1T3", TYPE: "F64", RW: "R"},
    "0x0432": {NAME: "importActiveEnergyL2T3", TYPE: "F64", RW: "R"},
    "0x0433": {NAME: "importActiveEnergyL3T3", TYPE: "F64", RW: "R"},
    "0x0440": {NAME: "importActiveEnergySystemT4", TYPE: "F64", RW: "R"},
    "0x0441": {NAME: "importActiveEnergyL1T4", TYPE: "F64", RW: "R"},
    "0x0442": {NAME: "importActiveEnergyL2T4", TYPE: "F64", RW: "R"},
    "0x0443": {NAME: "importActiveEnergyL3T4", TYPE: "F64", RW: "R"},
    "0x04A0": {NAME: "importActiveEnergySystemPartial", TYPE: "F64", RW: "R"},
    "0x04A1": {NAME: "importActiveEnergyL1Partial", TYPE: "F64", RW: "R"},
    "0x04A2": {NAME: "importActiveEnergyL2Partial", TYPE: "F64", RW: "R"},
    "0x04A3": {NAME: "importActiveEnergyL3Partial", TYPE: "F64", RW: "R"},
    "0x0500": {NAME: "exportActiveEnergySystem", TYPE: "F64", RW: "R"},
    "0x0501": {NAME: "exportActiveEnergyL1", TYPE: "F64", RW: "R"},
    "0x0502": {NAME: "exportActiveEnergyL2", TYPE: "F64", RW: "R"},
    "0x0503": {NAME: "exportActiveEnergyL3", TYPE: "F64", RW: "R"},
    "0x0510": {NAME: "exportActiveEnergySystemT1", TYPE: "F64", RW: "R"},
    "0x0511": {NAME: "exportActiveEnergyL1T1", TYPE: "F64", RW: "R"},
    "0x0512": {NAME: "exportActiveEnergyL2T1", TYPE: "F64", RW: "R"},
    "0x0513": {NAME: "exportActiveEnergyL3T1", TYPE: "F64", RW: "R"},
    "0x0520": {NAME: "exportActiveEnergySystemT2", TYPE: "F64", RW: "R"},
    "0x0521": {NAME: "exportActiveEnergyL1T2", TYPE: "F64", RW: "R"},
    "0x0522": {NAME: "exportActiveEnergyL2T2", TYPE: "F64", RW: "R"},
    "0x0523": {NAME: "exportActiveEnergyL3T2", TYPE: "F64", RW: "R"},
    "0x0530": {NAME: "exportActiveEnergySystemT3", TYPE: "F64", RW: "R"},
    "0x0531": {NAME: "exportActiveEnergyL1T3", TYPE: "F64", RW: "R"},
    "0x0532": {NAME: "exportActiveEnergyL2T3", TYPE: "F64", RW: "R"},
    "0x0533": {NAME: "exportActiveEnergyL3T3", TYPE: "F64", RW: "R"},
    "0x0540": {NAME: "exportActiveEnergySystemT4", TYPE: "F64", RW: "R"},
    "0x0541": {NAME: "exportActiveEnergyL1T4", TYPE: "F64", RW: "R"},
    "0x0542": {NAME: "exportActiveEnergyL2T4", TYPE: "F64", RW: "R"},
    "0x0543": {NAME: "exportActiveEnergyL3T4", TYPE: "F64", RW: "R"},
    "0x05A0": {NAME: "exportActiveEnergySystemPartial", TYPE: "F64", RW: "R"},
    "0x05A1": {NAME: "exportActiveEnergyL1Partial", TYPE: "F64", RW: "R"},
    "0x05A2": {NAME: "exportActiveEnergyL2Partial", TYPE: "F64", RW: "R"},
    "0x05A3": {NAME: "exportActiveEnergyL3Partial", TYPE: "F64", RW: "R"},
    "0x0600": {NAME: "importReactiveEnergySystem", TYPE: "F64", RW: "R"},
    "0x0601": {NAME: "importReactiveEnergyL1", TYPE: "F64", RW: "R"},
    "0x0602": {NAME: "importReactiveEnergyL2", TYPE: "F64", RW: "R"},
    "0x0603": {NAME: "importReactiveEnergyL3", TYPE: "F64", RW: "R"},
    "0x0610": {NAME: "importReactiveEnergySystemT1", TYPE: "F64", RW: "R"},
    "0x0611": {NAME: "importReactiveEnergyL1T1", TYPE: "F64", RW: "R"},
    "0x0612": {NAME: "importReactiveEnergyL2T1", TYPE: "F64", RW: "R"},
    "0x0613": {NAME: "importReactiveEnergyL3T1", TYPE: "F64", RW: "R"},
    "0x0620": {NAME: "importReactiveEnergySystemT2", TYPE: "F64", RW: "R"},
    "0x0621": {NAME: "importReactiveEnergyL1T2", TYPE: "F64", RW: "R"},
    "0x0622": {NAME: "importReactiveEnergyL2T2", TYPE: "F64", RW: "R"},
    "0x0623": {NAME: "importReactiveEnergyL3T2", TYPE: "F64", RW: "R"},
    "0x0630": {NAME: "importReactiveEnergySystemT3", TYPE: "F64", RW: "R"},
    "0x0631": {NAME: "importReactiveEnergyL1T3", TYPE: "F64", RW: "R"},
    "0x0632": {NAME: "importReactiveEnergyL2T3", TYPE: "F64", RW: "R"},
    "0x0633": {NAME: "importReactiveEnergyL3T3", TYPE: "F64", RW: "R"},
    "0x0640": {NAME: "importReactiveEnergySystemT4", TYPE: "F64", RW: "R"},
    "0x0641": {NAME: "importReactiveEnergyL1T4", TYPE: "F64", RW: "R"},
    "0x0642": {NAME: "importReactiveEnergyL2T4", TYPE: "F64", RW: "R"},
    "0x0643": {NAME: "importReactiveEnergyL3T4", TYPE: "F64", RW: "R"},
    "0x06A0": {NAME: "importReactiveEnergySystemPartial", TYPE: "F64", RW: "R"},
    "0x06A1": {NAME: "importReactiveEnergyL1Partial", TYPE: "F64", RW: "R"},
    "0x06A2": {NAME: "importReactiveEnergyL2Partial", TYPE: "F64", RW: "R"},
    "0x06A3": {NAME: "importReactiveEnergyL3Partial", TYPE: "F64", RW: "R"},
    "0x0700": {NAME: "exportReactiveEnergySystem", TYPE: "F64", RW: "R"},
    "0x0701": {NAME: "exportReactiveEnergyL1", TYPE: "F64", RW: "R"},
    "0x0702": {NAME: "exportReactiveEnergyL2", TYPE: "F64", RW: "R"},
    "0x0703": {NAME: "exportReactiveEnergyL3", TYPE: "F64", RW: "R"},
    "0x0710": {NAME: "exportReactiveEnergySystemT1", TYPE: "F64", RW: "R"},
    "0x0711": {NAME: "exportReactiveEnergyL1T1", TYPE: "F64", RW: "R"},
    "0x0712": {NAME: "exportReactiveEnergyL2T1", TYPE: "F64", RW: "R"},
    "0x0713": {NAME: "exportReactiveEnergyL3T1", TYPE: "F64", RW: "R"},
    "0x0720": {NAME: "exportReactiveEnergySystemT2", TYPE: "F64", RW: "R"},
    "0x0721": {NAME: "exportReactiveEnergyL1T2", TYPE: "F64", RW: "R"},
    "0x0722": {NAME: "exportReactiveEnergyL2T2", TYPE: "F64", RW: "R"},
    "0x0723": {NAME: "exportReactiveEnergyL3T2", TYPE: "F64", RW: "R"},
    "0x07A0": {NAME: "exportReactiveEnergySystemPartial", TYPE: "F64", RW: "R"},
    "0x07A1": {NAME: "exportReactiveEnergyL1Partial", TYPE: "F64", RW: "R"},
    "0x07A2": {NAME: "exportReactiveEnergyL2Partial", TYPE: "F64", RW: "R"},
    "0x07A3": {NAME: "exportReactiveEnergyL3Partial", TYPE: "F64", RW: "R"},
    "0x0800": {NAME: "activeEnergyBalanceSystem", TYPE: "F64", RW: "R"},
    "0x0801": {NAME: "activeEnergyBalanceL1", TYPE: "F64", RW: "R"},
    "0x0802": {NAME: "activeEnergyBalanceL2", TYPE: "F64", RW: "R"},
    "0x0803": {NAME: "activeEnergyBalanceL3", TYPE: "F64", RW: "R"},
    "0x08F0": {NAME: "reactiveEnergyBalanceSystem", TYPE: "F64", RW: "R"},
    "0x08F1": {NAME: "reactiveEnergyBalanceL1", TYPE: "F64", RW: "R"},
    "0x08F2": {NAME: "reactiveEnergyBalanceL2", TYPE: "F64", RW: "R"},
    "0x08F3": {NAME: "reactiveEnergyBalanceL3", TYPE: "F64", RW: "R"},

    /* Reactive energy per zone, float64 (kVArh) */
    "0xA100": {NAME: "reactiveEnergyZone1System", TYPE: "F64", RW: "R"},
    "0xA101": {NAME: "reactiveEnergyZone1L1", TYPE: "F64", RW: "R"},
    "0xA102": {NAME: "reactiveEnergyZone1L2", TYPE: "F64", RW: "R"},
    "0xA103": {NAME: "reactiveEnergyZone1L3", TYPE: "F64", RW: "R"},
    "0xA110": {NAME: "reactiveEnergyZone1SystemT1", TYPE: "F64", RW: "R"},
    "0xA111": {NAME: "reactiveEnergyZone1L1T1", TYPE: "F64", RW: "R"},
    "0xA112": {NAME: "reactiveEnergyZone1L2T1", TYPE: "F64", RW: "R"},
    "0xA113": {NAME: "reactiveEnergyZone1L3T1", TYPE: "F64", RW: "R"},
    "0xA120": {NAME: "reactiveEnergyZone1SystemT2", TYPE: "F64", RW: "R"},
    "0xA121": {NAME: "reactiveEnergyZone1L1T2", TYPE: "F64", RW: "R"},
    "0xA122": {NAME: "reactiveEnergyZone1L2T2", TYPE: "F64", RW: "R"},
    "0xA123": {NAME: "reactiveEnergyZone1L3T2", TYPE: "F64", RW: "R"},
    "0xA200": {NAME: "reactiveEnergyZone2System", TYPE: "F64", RW: "R"},
    "0xA201": {NAME: "reactiveEnergyZone2L1", TYPE: "F64", RW: "R"},
    "0xA202": {NAME: "reactiveEnergyZone2L2", TYPE: "F64", RW: "R"},
    "0xA203": {NAME: "reactiveEnergyZone2L3", TYPE: "F64", RW: "R"},
    "0xA210": {NAME: "reactiveEnergyZone2SystemT1", TYPE: "F64", RW: "R"},
    "0xA211": {NAME: "reactiveEnergyZone2L1T1", TYPE: "F64", RW: "R"},
    "0xA212": {NAME: "reactiveEnergyZone2L2T1", TYPE: "F64", RW: "R"},
    "0xA213": {NAME: "reactiveEnergyZone2L3T1", TYPE: "F64", RW: "R"},
    "0xA220": {NAME: "reactiveEnergyZone2SystemT2", TYPE: "F64", RW: "R"},
    "0xA221": {NAME: "reactiveEnergyZone2L1T2", TYPE: "F64", RW: "R"},
    "0xA222": {NAME: "reactiveEnergyZone2L2T2", TYPE: "F64", RW: "R"},
    "0xA223": {NAME: "reactiveEnergyZone2L3T2", TYPE: "F64", RW: "R"},
    "0xA300": {NAME: "reactiveEnergyZone3System", TYPE: "F64", RW: "R"},
    "0xA301": {NAME: "reactiveEnergyZone3L1", TYPE: "F64", RW: "R"},
    "0xA302": {NAME: "reactiveEnergyZone3L2", TYPE: "F64", RW: "R"},
    "0xA303": {NAME: "reactiveEnergyZone3L3", TYPE: "F64", RW: "R"},
    "0xA310": {NAME: "reactiveEnergyZone3SystemT1", TYPE: "F64", RW: "R"},
    "0xA311": {NAME: "reactiveEnergyZone3L1T1", TYPE: "F64", RW: "R"},
    "0xA312": {NAME: "reactiveEnergyZone3L2T1", TYPE: "F64", RW: "R"},
    "0xA313": {NAME: "reactiveEnergyZone3L3T1", TYPE: "F64", RW: "R"},
    "0xA320": {NAME: "reactiveEnergyZone3SystemT2", TYPE: "F64", RW: "R"},
    "0xA321": {NAME: "reactiveEnergyZone3L1T2", TYPE: "F64", RW: "R"},
    "0xA322": {NAME: "reactiveEnergyZone3L2T2", TYPE: "F64", RW: "R"},
    "0xA323": {NAME: "reactiveEnergyZone3L3T2", TYPE: "F64", RW: "R"},
    "0xA400": {NAME: "reactiveEnergyZone4System", TYPE: "F64", RW: "R"},
    "0xA401": {NAME: "reactiveEnergyZone4L1", TYPE: "F64", RW: "R"},
    "0xA402": {NAME: "reactiveEnergyZone4L2", TYPE: "F64", RW: "R"},
    "0xA403": {NAME: "reactiveEnergyZone4L3", TYPE: "F64", RW: "R"},
    "0xA410": {NAME: "reactiveEnergyZone4SystemT1", TYPE: "F64", RW: "R"},
    "0xA411": {NAME: "reactiveEnergyZone4L1T1", TYPE: "F64", RW: "R"},
    "0xA412": {NAME: "reactiveEnergyZone4L2T1", TYPE: "F64", RW: "R"},
    "0xA413": {NAME: "reactiveEnergyZone4L3T1", TYPE: "F64", RW: "R"},
    "0xA420": {NAME: "reactiveEnergyZone4SystemT2", TYPE: "F64", RW: "R"},
    "0xA421": {NAME: "reactiveEnergyZone4L1T2", TYPE: "F64", RW: "R"},
    "0xA422": {NAME: "reactiveEnergyZone4L2T2", TYPE: "F64", RW: "R"},
    "0xA423": {NAME: "reactiveEnergyZone4L3T2", TYPE: "F64", RW: "R"},

    /* Digital inputs: status and counters */
    "0x2100": {NAME: "digitalInputFlags", TYPE: "FLAGS", RW: "R", SIZE: 4, FLAGS: [
        {NAME: "digitalInput1Flag", BIT: 0, VALUES: ["NO_ERROR", "ERROR"]},
        {NAME: "digitalInput2Flag", BIT: 1, VALUES: ["NO_ERROR", "ERROR"]}
    ]},
    "0x2110": {NAME: "digitalInput1Counter", TYPE: "U32", RW: "R"},
    "0x2111": {NAME: "digitalInput1OnTime", TYPE: "U32", RW: "R"},
    "0x2120": {NAME: "digitalInput2Counter", TYPE: "U32", RW: "R"},
    "0x2121": {NAME: "digitalInput2OnTime", TYPE: "U32", RW: "R"},

    /* Diagnostics */
    "0xEEA0": {NAME: "diagnosticAlarms", TYPE: "FLAGS", RW: "R", SIZE: 4, FLAGS: [
        {NAME: "alarmLowVoltageLN", BIT: 0, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmLowCurrent", BIT: 1, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmLowActivePower", BIT: 2, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmLowReactivePower", BIT: 3, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmLowApparentPower", BIT: 4, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmLowPowerFactor", BIT: 5, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmLowFrequency", BIT: 6, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmHighVoltageLN", BIT: 16, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmHighCurrent", BIT: 17, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmHighActivePower", BIT: 18, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmHighReactivePower", BIT: 19, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmHighApparentPower", BIT: 20, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmHighPowerFactor", BIT: 21, VALUES: ["NO_ALARM", "ALARM"]},
        {NAME: "alarmHighFrequency", BIT: 22, VALUES: ["NO_ALARM", "ALARM"]}
    ]},
    // DEM4 bit layout; DEM1 and DEM2 meters report bit 0 = pulse error, bit 1 = current direction error.
    "0xEEE0": {NAME: "diagnosticErrorFlags", TYPE: "FLAGS", RW: "R", SIZE: 4, FLAGS: [
        {NAME: "pulse1ErrorFlag", BIT: 0, VALUES: ["NO_ERROR", "ERROR"]},
        {NAME: "pulse2ErrorFlag", BIT: 1, VALUES: ["NO_ERROR", "ERROR"]},
        {NAME: "phaseSequenceErrorFlag", BIT: 2, VALUES: ["NO_ERROR", "ERROR"]},
        {NAME: "currentDirectionErrorFlag", BIT: 3, VALUES: ["NO_ERROR", "ERROR"]}
    ]},

    /* Electrical installation labels */
    "0xEE3C": {NAME: "electricalCabinet", TYPE: "STR", RW: "RW"},
    "0xEE3D": {NAME: "electricalGroup", TYPE: "STR", RW: "RW"},

    /* Meter information */
    // Firmware version reported by the meter after each start, v0.0 until the meter has answered.
    // firmwareVersion (0xFF69) is the firmware version of the communication module.
    "0xEE3E": {NAME: "meterFirmwareVersion", TYPE: "VER", RW: "R"},

    /* Serial link to the meter */
    "0x6000": {NAME: "serialWatchdogAlarm", TYPE: "ENUM", RW: "R", VALUES: NORMAL_ALARM},
    "0x6001": {NAME: "serialModbusSlaveId", TYPE: "U8", RW: "RW", MIN: 1, MAX: 247},
    "0x6002": {NAME: "serialStopBits", TYPE: "U8", RW: "RW", ALLOWED: [1, 2]},    // 1.5 stop bits (3) is not supported
    "0x6003": {NAME: "serialParity", TYPE: "ENUM", RW: "RW", VALUES: SERIAL_PARITY_VALUES},
    "0x6004": {NAME: "serialDataWidth", TYPE: "U8", RW: "RW", ALLOWED: [5, 6, 7, 8]},
    "0x6005": {NAME: "serialBaudRate", TYPE: "U32", RW: "RW", ALLOWED: SERIAL_BAUD_RATES},
    "0x6009": {NAME: "serialModbusExecutionInterval", TYPE: "U16", RW: "RW", MIN: 50, MAX: 60000},
    "0x600A": {NAME: "serialModbusResponseTimeout", TYPE: "U16", RW: "RW", MIN: 10, MAX: 60000},
    "0x600C": {NAME: "serialModbusMaxRetries", TYPE: "U8", RW: "RW", MIN: 1, MAX: 5},

    /* Digital outputs (output 1 is factory fixed: read only) */
    "0x1000": {NAME: "digitalOutput1Source", TYPE: "ENUM", RW: "R", VALUES: DIGITAL_OUTPUT_SOURCE_VALUES},
    "0x1002": {NAME: "digitalOutput1Mode", TYPE: "ENUM", RW: "R", VALUES: DIGITAL_OUTPUT_MODE_VALUES},
    "0x1004": {NAME: "digitalOutput1EnergyWeight", TYPE: "U8", RW: "R", MIN: 1, MAX: 9},
    "0x1008": {NAME: "digitalOutput1Multiplier", TYPE: "ENUM", RW: "R", VALUES: DIGITAL_OUTPUT_MULTIPLIER_VALUES},
    "0x100C": {NAME: "digitalOutput1OnTime", TYPE: "U16", RW: "R", MIN: 30, MAX: 2500},
    "0x1020": {NAME: "digitalOutput2Source", TYPE: "ENUM", RW: "RW", VALUES: DIGITAL_OUTPUT_SOURCE_VALUES},
    "0x1022": {NAME: "digitalOutput2Mode", TYPE: "ENUM", RW: "RW", VALUES: DIGITAL_OUTPUT_MODE_VALUES},
    "0x1024": {NAME: "digitalOutput2EnergyWeight", TYPE: "U8", RW: "RW", MIN: 1, MAX: 9},
    "0x1028": {NAME: "digitalOutput2Multiplier", TYPE: "ENUM", RW: "RW", VALUES: DIGITAL_OUTPUT_MULTIPLIER_VALUES},
    "0x102C": {NAME: "digitalOutput2OnTime", TYPE: "U16", RW: "RW", MIN: 30, MAX: 2500},

    /* Digital input configuration (DEM4) */
    "0x2000": {NAME: "digitalInput1Source", TYPE: "ENUM", RW: "RW", VALUES: DIGITAL_INPUT_SOURCE_VALUES},
    "0x2004": {NAME: "digitalInput1Delay", TYPE: "U16", RW: "RW", MIN: 100, MAX: 2000},
    "0x2008": {NAME: "digitalInput1Edge", TYPE: "ENUM", RW: "RW", VALUES: DIGITAL_INPUT_EDGE_VALUES},
    "0x2010": {NAME: "digitalInput2Source", TYPE: "ENUM", RW: "RW", VALUES: DIGITAL_INPUT_SOURCE_VALUES},
    "0x2014": {NAME: "digitalInput2Delay", TYPE: "U16", RW: "RW", MIN: 100, MAX: 2000},
    "0x2018": {NAME: "digitalInput2Edge", TYPE: "ENUM", RW: "RW", VALUES: DIGITAL_INPUT_EDGE_VALUES},

    /* Demand calculation */
    "0x3000": {NAME: "demandMethod", TYPE: "ENUM", RW: "RW", VALUES: DEMAND_METHOD_VALUES},
    "0x3004": {NAME: "demandPeriod", TYPE: "U8", RW: "RW", MIN: 1, MAX: 60},
    "0x3008": {NAME: "demandRollingSubPeriod", TYPE: "U8", RW: "RW", MIN: 1, MAX: 60},

    /* Meter commands: write 1 to execute; reading returns 1 while the command is pending */
    "0x4000": {NAME: "meterSaveConfiguration", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},
    "0x4002": {NAME: "meterFactoryReset", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},
    "0x4004": {NAME: "meterRestart", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},
    "0x4006": {NAME: "meterClearDemandData", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},
    "0x4008": {NAME: "meterClearDigitalInputCounter", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},
    "0x400E": {NAME: "meterActivateTariff1", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},
    "0x4010": {NAME: "meterActivateTariff2", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},
    "0x4012": {NAME: "meterClearRunHours", TYPE: "U8", RW: "RW", MIN: 1, MAX: 1},

    /* Voltage and current transformers (DEM4) */
    "0x5000": {NAME: "voltageTransformerPrimary", TYPE: "U32", RW: "R"},
    "0x5001": {NAME: "voltageTransformerSecondary", TYPE: "U16", RW: "R"},
    "0x5002": {NAME: "currentTransformerPrimary", TYPE: "U16", RW: "RW", MIN: 1, MAX: 9999},
    "0x5003": {NAME: "currentTransformerSecondary", TYPE: "U16", RW: "RW", MIN: 0, MAX: 1},

    /* Relay outputs: global settings (IQ meter RCM) */
    "0xB0EC": {NAME: "overheatThreshold", TYPE: "U8", RW: "RW", MIN: 0, MAX: 75},
    "0xB0ED": {NAME: "protectionDelay", TYPE: "U16", RW: "RW", MIN: 1, MAX: 600},
    // LoRaWAN relay watchdog: relays to their initial state as soon as the network is lost, until the next join
    "0xB0EE": {NAME: "watchdog", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},

    /* Relay output channel 1 */
    "0xB100": {NAME: "channel1ControlMode", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 0, VALUES: CONTROL_MODE_VALUES},
    "0xB101": {NAME: "channel1InitialState", TYPE: "ENUM", RW: "RW", VALUES: OFF_ON},
    "0xB102": {NAME: "channel1WeekTimer", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB103": {NAME: "channel1WeekTimerScheduleValidity", TYPE: "ENUM", RW: "R", VALUES: INVALID_VALID},
    "0xB104": {NAME: "channel1DesiredState", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 2, VALUES: DESIRED_STATE_VALUES},
    "0xB105": {NAME: "channel1BleControl", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB106": {NAME: "channel1VoltageProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB107": {NAME: "channel1VoltageHighLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0xB108": {NAME: "channel1VoltageLowLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0xB109": {NAME: "channel1CurrentProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB10A": {NAME: "channel1CurrentLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 20},
    "0xB10B": {NAME: "channel1ConsumptionCumulative", TYPE: "U32", RW: "R"},
    "0xB10C": {NAME: "channel1ConsumptionCurrentUser", TYPE: "U32", RW: "RW", MIN: 0, MAX: 0},
    "0xB10D": {NAME: "channel1Prepaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB10E": {NAME: "channel1AllowedConsumption", TYPE: "U32", RW: "RW"},
    "0xB10F": {NAME: "channel1Postpaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB110": {NAME: "channel1MomentaryDuration", TYPE: "U8", RW: "RW", MIN: 1, MAX: 120},
    "0xB111": {NAME: "channel1MomentaryRequestId", TYPE: "U8", RW: "RW"},
    "0xB112": {NAME: "channel1OnOffCycles", TYPE: "U32", RW: "R"},
    "0xB113": {NAME: "channel1RelayStateInfo", TYPE: "STRUCT", RW: "R", SIZE: 4, DECODE: decodeRelayStateInfo},
    "0xB114": {NAME: "channel1RelayChangeOfState", TYPE: "STRUCT", RW: "", SIZE: 8, DECODE: decodeRelayChangeOfState},

    /* Relay output channel 2 */
    "0xB200": {NAME: "channel2ControlMode", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 0, VALUES: CONTROL_MODE_VALUES},
    "0xB201": {NAME: "channel2InitialState", TYPE: "ENUM", RW: "RW", VALUES: OFF_ON},
    "0xB202": {NAME: "channel2WeekTimer", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB203": {NAME: "channel2WeekTimerScheduleValidity", TYPE: "ENUM", RW: "R", VALUES: INVALID_VALID},
    "0xB204": {NAME: "channel2DesiredState", TYPE: "ENUM", RW: "RW", MIN: 0, MAX: 2, VALUES: DESIRED_STATE_VALUES},
    "0xB205": {NAME: "channel2BleControl", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB206": {NAME: "channel2VoltageProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB207": {NAME: "channel2VoltageHighLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0xB208": {NAME: "channel2VoltageLowLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 300},
    "0xB209": {NAME: "channel2CurrentProtection", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB20A": {NAME: "channel2CurrentLimit", TYPE: "U16", RW: "RW", MIN: 0, MAX: 20},
    "0xB20B": {NAME: "channel2ConsumptionCumulative", TYPE: "U32", RW: "R"},
    "0xB20C": {NAME: "channel2ConsumptionCurrentUser", TYPE: "U32", RW: "RW", MIN: 0, MAX: 0},
    "0xB20D": {NAME: "channel2Prepaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB20E": {NAME: "channel2AllowedConsumption", TYPE: "U32", RW: "RW"},
    "0xB20F": {NAME: "channel2Postpaid", TYPE: "ENUM", RW: "RW", VALUES: DISABLED_ENABLED},
    "0xB210": {NAME: "channel2MomentaryDuration", TYPE: "U8", RW: "RW", MIN: 1, MAX: 120},
    "0xB211": {NAME: "channel2MomentaryRequestId", TYPE: "U8", RW: "RW"},
    "0xB212": {NAME: "channel2OnOffCycles", TYPE: "U32", RW: "R"},
    "0xB213": {NAME: "channel2RelayStateInfo", TYPE: "STRUCT", RW: "R", SIZE: 4, DECODE: decodeRelayStateInfo},
    "0xB214": {NAME: "channel2RelayChangeOfState", TYPE: "STRUCT", RW: "", SIZE: 8, DECODE: decodeRelayChangeOfState},

    /* Relay output channel 1 week timer (minute of the day, Monday first) */
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

    /* Relay output channel 2 week timer (minute of the day, Monday first) */
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

// Max demand configuration fields (downlink on fPort 11).
var MAX_DEMAND_CONFIG = {
    CHANNEL: 0xFF,
    REGISTER: 0x40,
    MODE: 0x41,
    STATUS: 0x42,
    DATALOGGER_INTERVAL: 0x43,
    UPLINK_INTERVAL: 0x44
};

// fPort used by encodeDownlink() when the command has none.
var COMMAND_FPORTS = {
    Config: FPORT.GENERIC,
    Reading: FPORT.READING,
    MaxDemand: FPORT.MAX_DEMAND_CONFIG
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
    } else if (fPort === FPORT.MAX_DEMAND) {
        decodeMaxDemand(bytes, result);
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

/* FF01 <timestamp u32> then [<addr16><minutes before timestamp u16><value>]... */
function decodeMaxDemand(bytes, result) {
    if (registerKey(bytes, 0) !== "0xFF01" || bytes.length < 6) {
        addError(result, "Max demand payload must start with the FF01 timestamp");
        return;
    }
    var timestamp = readUint(bytes, 2, 4);
    var measurements = [];
    var index = 6;
    while (index < bytes.length) {
        var key = registerKey(bytes, index);
        if (key === null || !has(REGISTERS, key) || index + 4 > bytes.length) {
            addError(result, "Unknown or incomplete register " + key + " at index " + index);
            return;
        }
        var minutesBefore = readUint(bytes, index + 2, 2);
        var decoded = decodeValue(bytes, index + 4, REGISTERS[key]);
        if (decoded === null) {
            addError(result, "Payload too short for register " + key + " at index " + index);
            return;
        }
        measurements.push({name: REGISTERS[key].NAME, data: decoded.value, ts: timestamp - minutesBefore * 60});
        index = index + 4 + decoded.size;
    }
    result.data.packageTimestamp = timestamp;
    result.data.listOfMeasurements = measurements;
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
 * Commands (see IQ-DEM.txt for examples):
 *   {"fPort": 50, "Type": "Config", "Config": [{"Param": "adr", "Value": 1}]}
 *   {"fPort": 100, "Type": "Reading", "Reading": ["adr", "sf"]}
 *   {"fPort": 1-10, "Type": "Periodic", "Periodic": {"UplinkInterval": 15, "Mode": 0, "Status": 1,
 *       "Registers": ["voltageL1N"]}}      (any subset of the four fields)
 *   {"fPort": 11, "Type": "MaxDemand", "MaxDemand": {"Register": "currentMaxDemandTotal", "Mode": 0,
 *       "Status": 1, "DataloggerInterval": 5, "UplinkInterval": 30}}      (all five fields)
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
    } else if (command.Type === "MaxDemand") {
        if (fPort !== FPORT.MAX_DEMAND_CONFIG) {
            addError(result, MESSAGES.CMD_FPORT_INVALID);
        } else {
            encodeMaxDemand(command.MaxDemand, result);
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

/* The firmware only accepts the five fields together; intervals are minutes and not 0. */
function encodeMaxDemand(config, result) {
    if (!config || typeof config !== "object") {
        addError(result, MESSAGES.CMD_INVALID + ": please add MaxDemand object to the command");
        return;
    }
    var fields = ["Register", "Mode", "Status", "DataloggerInterval", "UplinkInterval"];
    for (var i = 0; i < fields.length; i = i + 1) {
        if (!has(config, fields[i])) {
            addError(result, MESSAGES.CMD_INVALID + ": please add " + fields[i] + " to MaxDemand");
            return;
        }
    }
    var name = config.Register;
    var keys = registerKeys();
    if (typeof name !== "string" || !has(keys, name) || REGISTERS[keys[name]].MAX_DEMAND !== true) {
        addError(result, MESSAGES.CMD_DATA_INVALID + ": please check Register in the command");
        return;
    }
    if (config.Mode !== 0 && config.Mode !== 1) {
        addError(result, MESSAGES.CMD_DATA_INVALID + ": please check Mode in the command");
        return;
    }
    if (config.Status !== 0 && config.Status !== 1) {
        addError(result, MESSAGES.CMD_DATA_INVALID + ": please check Status in the command");
        return;
    }
    if (!isInterval(config.DataloggerInterval)) {
        addError(result, MESSAGES.CMD_DATA_INVALID + ": please check DataloggerInterval in the command");
        return;
    }
    if (!isInterval(config.UplinkInterval)) {
        addError(result, MESSAGES.CMD_DATA_INVALID + ": please check UplinkInterval in the command");
        return;
    }
    result.bytes.push(MAX_DEMAND_CONFIG.CHANNEL, MAX_DEMAND_CONFIG.REGISTER);
    writeUint(result.bytes, parseInt(keys[name], 16), 2);
    result.bytes.push(MAX_DEMAND_CONFIG.CHANNEL, MAX_DEMAND_CONFIG.MODE, config.Mode);
    result.bytes.push(MAX_DEMAND_CONFIG.CHANNEL, MAX_DEMAND_CONFIG.STATUS, config.Status);
    result.bytes.push(MAX_DEMAND_CONFIG.CHANNEL, MAX_DEMAND_CONFIG.DATALOGGER_INTERVAL);
    writeUint(result.bytes, config.DataloggerInterval, 2);
    result.bytes.push(MAX_DEMAND_CONFIG.CHANNEL, MAX_DEMAND_CONFIG.UPLINK_INTERVAL);
    writeUint(result.bytes, config.UplinkInterval, 2);
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
