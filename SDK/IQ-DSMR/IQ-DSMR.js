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
 * @version     1.0.0
 * @copyright   YOBIIQ B.V. | https://www.yobiiq.com
 *
 * @release     19-10-2026
 * @update      21-10-2026
 *
 * @product     IQ DSMR (P1 port reader of smart electricity meters, DSMR 4/5 (NL), Smarty (LUX) and
 *              DSMR 2.2/3.0 (NL_LEGACY) profiles)
 *
 * @firmware    IQ DSMR v1.0.0
 *
 */


// Added to every decoded uplink, without overwriting decoded fields.
var CODEC_INFO = {
    codecVersion: "1.0.0",
    genericModel: "IQ DSMR",
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

var FUNCTION_VALUES = {0: "DISABLED", 1: "ENABLED"};

/*
 * Register table: one entry per register address, used to decode uplinks AND
 * to encode downlinks, so the two directions can never disagree on an address.
 *
 *   NAME        key in the decoded object, Param / Registers name in commands
 *   TYPE        U8 U16 U24 U32 I8 I16 I32 F32 F64 STR VER VER3 ENUM FLAGS HEX STRUCT
 *   RW          what the firmware accepts over LoRaWAN: "R", "W", "RW" or "" (uplink only)
 *   RESOLUTION  decoded value = raw * RESOLUTION (and raw = value / RESOLUTION when encoding)
 *   DECIMALS    rounding of scaled and float values (default 3, F64 default 6)
 *   VALUES      ENUM labels by raw value; unknown values decode as "UNKNOWN (<raw>)"
 *   FLAGS       FLAGS bits: [{NAME: ..., BIT: n, VALUES: [label when 0, label when 1]}]
 *   SIZE        byte size of FLAGS, HEX and STRUCT registers
 *   SIZE_OF     STRUCT of variable size: function (bytes, index) returning its size, -1 when truncated
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

    /* P1 port settings and state */
    "0x0101": {NAME: "dsmrProfile", TYPE: "ENUM", RW: "RW", VALUES: {0: "NL", 1: "LUX", 2: "NL_LEGACY"}},
    "0x0103": {NAME: "telegramStatus", TYPE: "ENUM", RW: "R", VALUES: {0: "NONE", 1: "VALID", 2: "CRC_ERROR",
        3: "FRAME_ERROR", 4: "DECRYPTION_ERROR"}},
    "0x0104": {NAME: "telegramCount", TYPE: "U32", RW: "R"},
    "0x0105": {NAME: "serialWatchdogFunction", TYPE: "ENUM", RW: "RW", VALUES: FUNCTION_VALUES},
    "0x0106": {NAME: "serialWatchdogTimeout", TYPE: "U16", RW: "RW", MIN: 1, MAX: 1440},
    "0x0107": {NAME: "serialWatchdogAlarm", TYPE: "ENUM", RW: "R", VALUES: {0: "NORMAL", 1: "ALARM"}},
    "0x0108": {NAME: "meterIdentification", TYPE: "STR", RW: "R"},
    "0x0109": {NAME: "telegramErrorCount", TYPE: "U32", RW: "R"},

    /* Decryption of the LUX profile telegrams: the key of the meter (32 hexadecimal digits) can be
       written but never read over LoRaWAN; the function is ignored by the NL and NL_LEGACY profiles */
    "0x01DD": {NAME: "decryptionKey", TYPE: "HEX", RW: "W", SIZE: 16},
    "0x01DE": {NAME: "decryptionFunction", TYPE: "ENUM", RW: "RW", VALUES: FUNCTION_VALUES},

    /* Values of the last valid telegram. Energy in Wh, power in W, timestamps in UTC Unix time */
    "0x0110": {NAME: "p1Version", TYPE: "STRUCT", RW: "R", SIZE: 1, DECODE: decodeP1Version},
    "0x0111": {NAME: "telegramTimestamp", TYPE: "U32", RW: "R"},
    "0x0112": {NAME: "equipmentIdentifier", TYPE: "STR", RW: "R"},
    "0x0113": {NAME: "electricityDeliveredToClient", TYPE: "U32", RW: "R"},
    "0x0114": {NAME: "electricityDeliveredToClientT1", TYPE: "U32", RW: "R"},
    "0x0115": {NAME: "electricityDeliveredToClientT2", TYPE: "U32", RW: "R"},
    "0x0116": {NAME: "electricityDeliveredByClient", TYPE: "U32", RW: "R"},
    "0x0117": {NAME: "electricityDeliveredByClientT1", TYPE: "U32", RW: "R"},
    "0x0118": {NAME: "electricityDeliveredByClientT2", TYPE: "U32", RW: "R"},
    "0x0119": {NAME: "tariffIndicator", TYPE: "U8", RW: "R"},
    "0x011A": {NAME: "electricityPowerDelivered", TYPE: "U32", RW: "R"},
    "0x011B": {NAME: "electricityPowerReceived", TYPE: "U32", RW: "R"},
    "0x011C": {NAME: "numberOfPowerFailures", TYPE: "U32", RW: "R"},
    "0x011D": {NAME: "numberOfLongPowerFailures", TYPE: "U32", RW: "R"},
    "0x011E": {NAME: "powerFailureEventLog", TYPE: "STRUCT", RW: "R", SIZE_OF: powerFailureEventLogSize,
        DECODE: decodePowerFailureEventLog},
    "0x011F": {NAME: "numberOfVoltageSagsL1", TYPE: "U32", RW: "R"},
    "0x0120": {NAME: "numberOfVoltageSagsL2", TYPE: "U32", RW: "R"},
    "0x0121": {NAME: "numberOfVoltageSagsL3", TYPE: "U32", RW: "R"},
    "0x0122": {NAME: "numberOfVoltageSwellsL1", TYPE: "U32", RW: "R"},
    "0x0123": {NAME: "numberOfVoltageSwellsL2", TYPE: "U32", RW: "R"},
    "0x0124": {NAME: "numberOfVoltageSwellsL3", TYPE: "U32", RW: "R"},
    "0x0125": {NAME: "voltageL1", TYPE: "U16", RW: "R", RESOLUTION: 0.1, DECIMALS: 1},
    "0x0126": {NAME: "voltageL2", TYPE: "U16", RW: "R", RESOLUTION: 0.1, DECIMALS: 1},
    "0x0127": {NAME: "voltageL3", TYPE: "U16", RW: "R", RESOLUTION: 0.1, DECIMALS: 1},
    "0x0128": {NAME: "currentL1", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0x0129": {NAME: "currentL2", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0x012A": {NAME: "currentL3", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2},
    "0x012B": {NAME: "activePowerDeliveredL1", TYPE: "U32", RW: "R"},
    "0x012C": {NAME: "activePowerDeliveredL2", TYPE: "U32", RW: "R"},
    "0x012D": {NAME: "activePowerDeliveredL3", TYPE: "U32", RW: "R"},
    "0x012E": {NAME: "activePowerReceivedL1", TYPE: "U32", RW: "R"},
    "0x012F": {NAME: "activePowerReceivedL2", TYPE: "U32", RW: "R"},
    "0x0130": {NAME: "activePowerReceivedL3", TYPE: "U32", RW: "R"},

    /* M-Bus channels 1 to 4 (gas, water, thermal or slave meters). The last reading is the capture
       time and the value in the meter unit (for example m3), sent in thousandths */
    "0x0131": {NAME: "deviceTypeOnChannel1", TYPE: "U8", RW: "R"},
    "0x0132": {NAME: "equipmentIdentifierChannel1", TYPE: "STR", RW: "R"},
    "0x0133": {NAME: "lastReadingOnChannel1", TYPE: "STRUCT", RW: "R", SIZE: 8, DECODE: decodeMbusReading},
    "0x0134": {NAME: "deviceTypeOnChannel2", TYPE: "U8", RW: "R"},
    "0x0135": {NAME: "equipmentIdentifierChannel2", TYPE: "STR", RW: "R"},
    "0x0136": {NAME: "lastReadingOnChannel2", TYPE: "STRUCT", RW: "R", SIZE: 8, DECODE: decodeMbusReading},
    "0x0137": {NAME: "deviceTypeOnChannel3", TYPE: "U8", RW: "R"},
    "0x0138": {NAME: "equipmentIdentifierChannel3", TYPE: "STR", RW: "R"},
    "0x0139": {NAME: "lastReadingOnChannel3", TYPE: "STRUCT", RW: "R", SIZE: 8, DECODE: decodeMbusReading},
    "0x013A": {NAME: "deviceTypeOnChannel4", TYPE: "U8", RW: "R"},
    "0x013B": {NAME: "equipmentIdentifierChannel4", TYPE: "STR", RW: "R"},
    "0x013C": {NAME: "lastReadingOnChannel4", TYPE: "STRUCT", RW: "R", SIZE: 8, DECODE: decodeMbusReading},

    /* Values of the Luxembourg Smarty telegrams. Reactive energy in varh, reactive power in var */
    "0x0140": {NAME: "totalImportedReactiveEnergy", TYPE: "U32", RW: "R"},
    "0x0141": {NAME: "totalExportedReactiveEnergy", TYPE: "U32", RW: "R"},
    "0x0142": {NAME: "totalImportedReactivePower", TYPE: "U32", RW: "R"},
    "0x0143": {NAME: "totalExportedReactivePower", TYPE: "U32", RW: "R"},
    "0x0144": {NAME: "importedReactivePowerL1", TYPE: "U32", RW: "R"},
    "0x0145": {NAME: "importedReactivePowerL2", TYPE: "U32", RW: "R"},
    "0x0146": {NAME: "importedReactivePowerL3", TYPE: "U32", RW: "R"},
    "0x0147": {NAME: "exportedReactivePowerL1", TYPE: "U32", RW: "R"},
    "0x0148": {NAME: "exportedReactivePowerL2", TYPE: "U32", RW: "R"},
    "0x0149": {NAME: "exportedReactivePowerL3", TYPE: "U32", RW: "R"},
    "0x014A": {NAME: "activeThreshold", TYPE: "U32", RW: "R", RESOLUTION: 0.001, DECIMALS: 3},
    "0x014B": {NAME: "breakerControlState", TYPE: "U8", RW: "R"},
    "0x014C": {NAME: "fuseSupervisionThresholdL1", TYPE: "U16", RW: "R", RESOLUTION: 0.01, DECIMALS: 2}
};

var HEX_DIGITS = "0123456789ABCDEF";

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
    case "HEX":
        value = readHex(bytes, index, size);
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
    if (reg.SIZE_OF) {
        return reg.SIZE_OF(bytes, index);
    }
    if (reg.TYPE === "FLAGS" || reg.TYPE === "HEX" || reg.TYPE === "STRUCT") {
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

/* P1 output version: 50 is "v5.0" */
function decodeP1Version(bytes, index) {
    return "v" + Math.floor(bytes[index] / 10) + "." + (bytes[index] % 10);
}

/* Number of events, then per event its end (UTC Unix time) and its duration in seconds, oldest first */
function powerFailureEventLogSize(bytes, index) {
    return index < bytes.length ? 1 + 8 * bytes[index] : -1;
}

function decodePowerFailureEventLog(bytes, index) {
    var events = [];
    for (var i = 0; i < bytes[index]; i = i + 1) {
        var offset = index + 1 + 8 * i;
        events.push({timestamp: readUint(bytes, offset, 4), duration: readUint(bytes, offset + 4, 4)});
    }
    return events;
}

/* Capture time (UTC Unix time), then the value in thousandths of the meter unit */
function decodeMbusReading(bytes, index) {
    return {timestamp: readUint(bytes, index, 4), value: round(readUint(bytes, index + 4, 4) * 0.001, 3)};
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

/* NaN and infinities (read errors) decode as null. */
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

function readHex(bytes, index, size) {
    var text = "";
    for (var i = 0; i < size; i = i + 1) {
        text = text + byteToHex(bytes[index + i]);
    }
    return text;
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
 * Commands (see IQ-DSMR.txt for examples):
 *   {"fPort": 50, "Type": "Config", "Config": [{"Param": "adr", "Value": 1}]}
 *   {"fPort": 100, "Type": "Reading", "Reading": ["adr", "sf"]}
 *   {"fPort": 1-10, "Type": "Periodic", "Periodic": {"UplinkInterval": 15, "Mode": 0, "Status": 1,
 *       "Registers": ["voltageL1"]}}      (any subset of the four fields)
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
    if (reg.TYPE === "HEX") {
        return parseHex(value, reg.SIZE);
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

/* HEX writes: exactly 2 * size hexadecimal digits, upper or lower case. @returns the bytes or null */
function parseHex(value, size) {
    if (typeof value !== "string" || value.length !== 2 * size) {
        return null;
    }
    var out = [];
    for (var i = 0; i < value.length; i = i + 2) {
        var high = HEX_DIGITS.indexOf(value.charAt(i).toUpperCase());
        var low = HEX_DIGITS.indexOf(value.charAt(i + 1).toUpperCase());
        if (high < 0 || low < 0) {
            return null;
        }
        out.push(high * 16 + low);
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
