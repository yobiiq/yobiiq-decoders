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
 * @compatibility TTN, TTI, LORIOT, ThingPark, ChirpStack v3/v4 and any LNS that follows LoRa Alliance API specs.
 * 
 * @author      Fostin Kpodar <f.kpodar@yobiiq.com>
 * @version     1.0.0
 * @copyright   YOBIIQ B.V. | https://www.yobiiq.com
 * 
 * @release     16-07-2026
 * @update      19-08-2026
 * 
 * @product     26000x   IQ DEM (compatible with DEM1, DEM2 and DEM4 models)
 * 
 * @firmware    
 * 
 */


// Version Control
var VERSION_CONTROL = {
    CODEC : {VERSION: "1.0.0", NAME: "codecVersion"},
    DEVICE: {MODEL : "IQ DEM", NAME: "genericModel"},
    PRODUCT: {CODE : "26000x", NAME: "productCode"},
    MANUFACTURER: {COMPANY : "YOBIIQ B.V.", NAME: "manufacturer"}
};

var UPLINK = {
    // generic data
    GENERIC_DATA : {
        CHANNEL    : 0xFF,
        FPORT_MIN  : 50,
        FPORT_MAX  : 99
    },
    // device data
    DEVICE_DATA : {
        FPORT_MIN : 1,
        FPORT_MAX : 10
    },
    // alarm data
    ALARM_DATA : {
        FPORT    : 11
    },
    // max demand historic data
    MAX_DEMAND_DATA : {
        FPORT    : 20
    },
    // parameter data
    PARAMETER_DATA : {
        FPORT    : 100
    },
    // general
    MAC : {
        FPORT : 0,
        MSG: "MAC COMMAND RECEIVED"
    },
    FUOTA : {
        FPORT_MIN : 200,
        FPORT_MAX : 202,
        MSG: "FUOTA DATA RECEIVED"
    },
    FMP : {
        FPORT : 203,
        MSG: "FIRMWARE MANAGEMENT DATA RECEIVED"
    },
    DOWNLINK : {
        SUCCESS : "DOWNLINK COMMAND SUCCEEDED",
        FAILURE : "DOWNLINK COMMAND FAILED"
    },
    ERRORS : {
        REGISTER: "Unknown register ",
        FPORT_INCORRECT: "Incorrect fPort"
    },
    WARNING_NAME   : "warning",
    ERROR_NAME     : "error",
    INFO_NAME      : "info"
};

var DEVICE_GENERIC_REGISTERS = {

    "0xFF01" : {TYPE : 'U32', NAME : "dataloggerTimestamp"},
    "0xFF02" : {TYPE : 'U32', NAME : "timestamp"},

    "0xFF32" : {TYPE : 'STR', NAME : "buildingName"},
    "0xFF33" : {TYPE : 'STR', NAME : "buildingRoom"},
    "0xFF34" : {TYPE : 'STR', NAME : "deviceName"},

    "0xFF64" : {TYPE : 'ENUM', NAME : "deviceStatus",
        VALUES : { "0x00" : "NORMAL MODE"}
    },
    "0xFF65" : {TYPE : 'STR', NAME : "manufacturer"},
    "0xFF66" : {TYPE : 'STR', NAME : "originalEquipmentManufacturer"},
    "0xFF67" : {TYPE : 'STR', NAME : "deviceModel"},
    "0xFF68" : {TYPE : 'U32', NAME : "deviceSerialNumber"},
    "0xFF69" : {TYPE : 'VER', NAME : "firmwareVersion"},
    "0xFF6A" : {TYPE : 'VER', NAME : "hardwareVersion"},
    "0xFF6B" : {TYPE : 'ENUM', NAME : "externalPowerStatus",
        VALUES : { "0x00" : "AC POWER OFF", "0x01" : "AC POWER ON"}
    },
    "0xFF6C" : {TYPE : 'U8', NAME : "batteryVoltage", RESOLUTION: 0.1},
    "0xFF6D" : {TYPE : 'U8', NAME : "batteryPercentage"},
    "0xFF78" : {TYPE: 'ENUM', NAME : "internalCircuitTemperatureAlarm", 
        VALUES: {"0x00" : "NORMAL", "0x01" : "ALARM"}
    },
    "0xFF79" : {TYPE: 'U32', NAME : "internalCircuitTemperatureNumberOfAlarms"},
    "0xFF7A" : {TYPE: 'I16', NAME : "internalCircuitTemperature", RESOLUTION: 0.01},
    "0xFF7B" : {TYPE: 'U8', NAME : "internalCircuitHumidity"},
    "0xFF82" : {TYPE: 'I16', NAME : "ambientTemperature", RESOLUTION: 0.01},
    "0xFF83" : {TYPE: 'U8', NAME : "ambientHumidity"},
    "0xFF96" : {TYPE : 'ENUM', NAME : "joinStatus",
        VALUES : { "0x00" : "OFFLINE", "0x01" : "ONLINE"}
    },
    "0xFF9D" : {TYPE: 'U8', NAME : "applicationPort"},
    "0xFF9E" : {TYPE: 'ENUM', NAME : "joinType",
        VALUES : { "0x01" : "OTAA"}
    },
    "0xFF9F" : {TYPE : 'ENUM', NAME : "deviceClass",
        VALUES : { "0x00" : "CLASS A", "0x01" : "CLASS B", "0x02" : "CLASS C"}
    },
    "0xFFA0" : {TYPE: 'ENUM', NAME: "adr", 
        VALUES: {"0x00" : "DISABLED", "0x01" : "ENABLED"}
    },
    "0xFFA1" : {TYPE: 'ENUM', NAME: "sf", 
        VALUES: { "0x00" : "SF12BW125", "0x01" : "SF11BW125", "0x02" : "SF10BW125",
            "0x03" : "SF9BW125", "0x04" : "SF8BW125", "0x05" : "SF7BW125", "0x06" : "SF7BW250"}
    },
    "0xFFA2" : {TYPE: 'ENUM', NAME: "adrProfile", 
        VALUES: { "0x00" : "NETWORK_CONTROLLED", "0x01" : "MOBILE_LONG_RANGE", "0x02" : "MOBILE_LOW_POWER"}
    },
    "0xFFA3" : {TYPE: 'ENUM', NAME: "radioMode",
        VALUES: { "0x00" : "LoRaWAN", "0x01" : "iQ D2D", "0x02" : "LoRaWAN & iQ D2D"}
    },
    "0xFFA4" : {TYPE: 'U8', NAME: "numberOfJoinAttempts"},
    "0xFFA5" : {TYPE: 'U16', NAME: "linkCheckTimeframe"},
    "0xFFA6" : {TYPE: 'ENUM', NAME: "dataRetransmission", 
        VALUES: { "0x00" : "DISABLED", "0x01" : "ENABLED"}
    },
    "0xFFA7" : {TYPE: 'ENUM', NAME: "lorawanWatchdogAlarm",
        VALUES: { "0x00" : "NORMAL", "0x01" : "ALARM"}
    }
};

var DEVICE_SPECIFIC_REGISTERS = {

    "0xEE3C" : {TYPE : 'STR', NAME : "electricalCabinet"},
    "0xEE3D" : {TYPE : 'STR', NAME : "electricalGroup"},

    "0x6000" : {TYPE: 'ENUM', NAME: "serialWatchdogAlarm", 
        VALUES: { "0x00" : "NORMAL", "0x01" : "ALARM"}
    },
    "0x6001" : {TYPE: 'U8', NAME: "serialModbusSlaveId"},
    "0x6002" : {TYPE: 'U8', NAME: "serialStopBits"},
    "0x6003" : {TYPE: 'U8', NAME: "serialParity",
        VALUES: { "0x00" : "NONE", "0x01" : "ODD", "0x02" : "EVEN"}
    },
    "0x6004" : {TYPE: 'U8', NAME: "serialDataWidth"},
    "0x6005" : {TYPE: 'U32', NAME: "serialBaudRate"},
    "0x6009" : {TYPE: 'U16', NAME: "serialModbusExecutionInterval"},
    "0x600A" : {TYPE: 'U16', NAME: "serialModbusResponseTimeout"},
    "0x600C" : {TYPE: 'U8', NAME: "serialModbusMaxRetries"},

    "0x0000" : {TYPE : 'F32', NAME : "frequency", UNIT : "Hz"},
    "0x0010" : {TYPE : 'I32', NAME : "phaseSequence"},

    "0x0100" : {TYPE : 'F32', NAME : "voltageAvgLN", UNIT : "V"},
    "0x0101" : {TYPE : 'F32', NAME : "voltageL1N", UNIT : "V"},
    "0x0102" : {TYPE : 'F32', NAME : "voltageL2N", UNIT : "V"},
    "0x0103" : {TYPE : 'F32', NAME : "voltageL3N", UNIT : "V"},
    "0x0104" : {TYPE : 'F32', NAME : "voltageL1L2", UNIT : "V"},
    "0x0105" : {TYPE : 'F32', NAME : "voltageL2L3", UNIT : "V"},
    "0x0106" : {TYPE : 'F32', NAME : "voltageL3L1", UNIT : "V"},
    "0x0107" : {TYPE : 'F32', NAME : "voltageAvgLL", UNIT : "V"},
    "0x0111" : {TYPE : 'F32', NAME : "voltageThdL1", UNIT : "V"},
    "0x0112" : {TYPE : 'F32', NAME : "voltageThdL2", UNIT : "V"},
    "0x0113" : {TYPE : 'F32', NAME : "voltageThdL3", UNIT : "V"},

    "0x0200" : {TYPE : 'F32', NAME : "currentTotal", UNIT : "A"},
    "0x0201" : {TYPE : 'F32', NAME : "currentL1", UNIT : "A"},
    "0x0202" : {TYPE : 'F32', NAME : "currentL2", UNIT : "A"},
    "0x0203" : {TYPE : 'F32', NAME : "currentL3", UNIT : "A"},
    "0x0204" : {TYPE : 'F32', NAME : "currentNeutral", UNIT : "A"},
    "0x0211" : {TYPE : 'F32', NAME : "currentThdL1", UNIT : "A"},
    "0x0212" : {TYPE : 'F32', NAME : "currentThdL2", UNIT : "A"},
    "0x0213" : {TYPE : 'F32', NAME : "currentThdL3", UNIT : "A"},
    "0x0220" : {TYPE : 'F32', NAME : "currentAvg", UNIT : "A"},
    "0x0221" : {TYPE : 'F32', NAME : "currentAvgL1", UNIT : "A"},
    "0x0222" : {TYPE : 'F32', NAME : "currentAvgL2", UNIT : "A"},
    "0x0223" : {TYPE : 'F32', NAME : "currentAvgL3", UNIT : "A"},
    "0x02D0" : {TYPE : 'F32', NAME : "currentDemandTotal", UNIT : "A"},
    "0x02D1" : {TYPE : 'F32', NAME : "currentDemandL1", UNIT : "A"},
    "0x02D2" : {TYPE : 'F32', NAME : "currentDemandL2", UNIT : "A"},
    "0x02D3" : {TYPE : 'F32', NAME : "currentDemandL3", UNIT : "A"},
    "0x02E0" : {TYPE : 'F32', NAME : "currentMaxDemandTotal", UNIT : "A"},
    "0x02E1" : {TYPE : 'F32', NAME : "currentMaxDemandL1", UNIT : "A"},
    "0x02E2" : {TYPE : 'F32', NAME : "currentMaxDemandL2", UNIT : "A"},
    "0x02E3" : {TYPE : 'F32', NAME : "currentMaxDemandL3", UNIT : "A"},

    "0x0300" : {TYPE : 'F32', NAME : "activePowerTotal", UNIT : "W"},
    "0x0301" : {TYPE : 'F32', NAME : "activePowerL1", UNIT : "W"},
    "0x0302" : {TYPE : 'F32', NAME : "activePowerL2", UNIT : "W"},
    "0x0303" : {TYPE : 'F32', NAME : "activePowerL3", UNIT : "W"},
    "0x0310" : {TYPE : 'F32', NAME : "activePowerImportDemand", UNIT : "W"},
    "0x0320" : {TYPE : 'F32', NAME : "activePowerExportDemand", UNIT : "W"},
    "0x0330" : {TYPE : 'F32', NAME : "activePowerImportMaxDemand", UNIT : "W"},
    "0x0340" : {TYPE : 'F32', NAME : "activePowerExportMaxDemand", UNIT : "W"},

    "0x0350" : {TYPE : 'F32', NAME : "reactivePowerTotal", UNIT : "VAr"},
    "0x0351" : {TYPE : 'F32', NAME : "reactivePowerL1", UNIT : "VAr"},
    "0x0352" : {TYPE : 'F32', NAME : "reactivePowerL2", UNIT : "VAr"},
    "0x0353" : {TYPE : 'F32', NAME : "reactivePowerL3", UNIT : "VAr"},
    "0x0360" : {TYPE : 'F32', NAME : "reactivePowerImportDemand", UNIT : "VAr"},
    "0x0370" : {TYPE : 'F32', NAME : "reactivePowerExportDemand", UNIT : "VAr"},
    "0x0380" : {TYPE : 'F32', NAME : "reactivePowerImportMaxDemand", UNIT : "VAr"},
    "0x0390" : {TYPE : 'F32', NAME : "reactivePowerExportMaxDemand", UNIT : "VAr"},

    "0x03A0" : {TYPE : 'F32', NAME : "apparentPowerTotal", UNIT : "VA"},
    "0x03A1" : {TYPE : 'F32', NAME : "apparentPowerL1", UNIT : "VA"},
    "0x03A2" : {TYPE : 'F32', NAME : "apparentPowerL2", UNIT : "VA"},
    "0x03A3" : {TYPE : 'F32', NAME : "apparentPowerL3", UNIT : "VA"},
    "0x03B0" : {TYPE : 'F32', NAME : "apparentPowerDemand", UNIT : "VA"},
    "0x03C0" : {TYPE : 'F32', NAME : "apparentPowerMaxDemand", UNIT : "VA"},

    "0x03D1" : {TYPE : 'F32', NAME : "phaseAngleL1", UNIT : "°"},
    "0x03D2" : {TYPE : 'F32', NAME : "phaseAngleL2", UNIT : "°"},
    "0x03D3" : {TYPE : 'F32', NAME : "phaseAngleL3", UNIT : "°"},

    "0x03E1" : {TYPE : 'F32', NAME : "cosPhiL1"},
    "0x03E2" : {TYPE : 'F32', NAME : "cosPhiL2"},
    "0x03E3" : {TYPE : 'F32', NAME : "cosPhiL3"},

    "0x03F0" : {TYPE : 'F32', NAME : "powerFactorSystem"},
    "0x03F1" : {TYPE : 'F32', NAME : "powerFactorL1"},
    "0x03F2" : {TYPE : 'F32', NAME : "powerFactorL2"},
    "0x03F3" : {TYPE : 'F32', NAME : "powerFactorL3"},

    "0x0400" : {TYPE : 'F64', NAME : "importActiveEnergySystem", UNIT : "kWh"},
    "0x0401" : {TYPE : 'F64', NAME : "importActiveEnergyL1", UNIT : "kWh"},
    "0x0402" : {TYPE : 'F64', NAME : "importActiveEnergyL2", UNIT : "kWh"},
    "0x0403" : {TYPE : 'F64', NAME : "importActiveEnergyL3", UNIT : "kWh"},
    "0x0410" : {TYPE : 'F64', NAME : "importActiveEnergySystemT1", UNIT : "kWh"},
    "0x0411" : {TYPE : 'F64', NAME : "importActiveEnergyL1T1", UNIT : "kWh"},
    "0x0412" : {TYPE : 'F64', NAME : "importActiveEnergyL2T1", UNIT : "kWh"},
    "0x0413" : {TYPE : 'F64', NAME : "importActiveEnergyL3T1", UNIT : "kWh"},
    "0x0420" : {TYPE : 'F64', NAME : "importActiveEnergySystemT2", UNIT : "kWh"},
    "0x0421" : {TYPE : 'F64', NAME : "importActiveEnergyL1T2", UNIT : "kWh"},
    "0x0422" : {TYPE : 'F64', NAME : "importActiveEnergyL2T2", UNIT : "kWh"},
    "0x0423" : {TYPE : 'F64', NAME : "importActiveEnergyL3T2", UNIT : "kWh"},
    "0x0430" : {TYPE : 'F64', NAME : "importActiveEnergySystemT3", UNIT : "kWh"},
    "0x0431" : {TYPE : 'F64', NAME : "importActiveEnergyL1T3", UNIT : "kWh"},
    "0x0432" : {TYPE : 'F64', NAME : "importActiveEnergyL2T3", UNIT : "kWh"},
    "0x0433" : {TYPE : 'F64', NAME : "importActiveEnergyL3T3", UNIT : "kWh"},
    "0x0440" : {TYPE : 'F64', NAME : "importActiveEnergySystemT4", UNIT : "kWh"},
    "0x0441" : {TYPE : 'F64', NAME : "importActiveEnergyL1T4", UNIT : "kWh"},
    "0x0442" : {TYPE : 'F64', NAME : "importActiveEnergyL2T4", UNIT : "kWh"},
    "0x0443" : {TYPE : 'F64', NAME : "importActiveEnergyL3T4", UNIT : "kWh"},
    "0x04A0" : {TYPE : 'F64', NAME : "importActiveEnergySystemPartial", UNIT : "kWh"},
    "0x04A1" : {TYPE : 'F64', NAME : "importActiveEnergyL1Partial", UNIT : "kWh"},
    "0x04A2" : {TYPE : 'F64', NAME : "importActiveEnergyL2Partial", UNIT : "kWh"},
    "0x04A3" : {TYPE : 'F64', NAME : "importActiveEnergyL3Partial", UNIT : "kWh"},

    "0x0500" : {TYPE : 'F64', NAME : "exportActiveEnergySystem", UNIT : "kWh"},
    "0x0501" : {TYPE : 'F64', NAME : "exportActiveEnergyL1", UNIT : "kWh"},
    "0x0502" : {TYPE : 'F64', NAME : "exportActiveEnergyL2", UNIT : "kWh"},
    "0x0503" : {TYPE : 'F64', NAME : "exportActiveEnergyL3", UNIT : "kWh"},
    "0x0510" : {TYPE : 'F64', NAME : "exportActiveEnergySystemT1", UNIT : "kWh"},
    "0x0511" : {TYPE : 'F64', NAME : "exportActiveEnergyL1T1", UNIT : "kWh"},
    "0x0512" : {TYPE : 'F64', NAME : "exportActiveEnergyL2T1", UNIT : "kWh"},
    "0x0513" : {TYPE : 'F64', NAME : "exportActiveEnergyL3T1", UNIT : "kWh"},
    "0x0520" : {TYPE : 'F64', NAME : "exportActiveEnergySystemT2", UNIT : "kWh"},
    "0x0521" : {TYPE : 'F64', NAME : "exportActiveEnergyL1T2", UNIT : "kWh"},
    "0x0522" : {TYPE : 'F64', NAME : "exportActiveEnergyL2T2", UNIT : "kWh"},
    "0x0523" : {TYPE : 'F64', NAME : "exportActiveEnergyL3T2", UNIT : "kWh"},
    "0x0530" : {TYPE : 'F64', NAME : "exportActiveEnergySystemT3", UNIT : "kWh"},
    "0x0531" : {TYPE : 'F64', NAME : "exportActiveEnergyL1T3", UNIT : "kWh"},
    "0x0532" : {TYPE : 'F64', NAME : "exportActiveEnergyL2T3", UNIT : "kWh"},
    "0x0533" : {TYPE : 'F64', NAME : "exportActiveEnergyL3T3", UNIT : "kWh"},
    "0x0540" : {TYPE : 'F64', NAME : "exportActiveEnergySystemT4", UNIT : "kWh"},
    "0x0541" : {TYPE : 'F64', NAME : "exportActiveEnergyL1T4", UNIT : "kWh"},
    "0x0542" : {TYPE : 'F64', NAME : "exportActiveEnergyL2T4", UNIT : "kWh"},
    "0x0543" : {TYPE : 'F64', NAME : "exportActiveEnergyL3T4", UNIT : "kWh"},
    "0x05A0" : {TYPE : 'F64', NAME : "exportActiveEnergySystemPartial", UNIT : "kWh"},
    "0x05A1" : {TYPE : 'F64', NAME : "exportActiveEnergyL1Partial", UNIT : "kWh"},
    "0x05A2" : {TYPE : 'F64', NAME : "exportActiveEnergyL2Partial", UNIT : "kWh"},
    "0x05A3" : {TYPE : 'F64', NAME : "exportActiveEnergyL3Partial", UNIT : "kWh"},

    "0x0600" : {TYPE : 'F64', NAME : "importReactiveEnergySystem", UNIT : "kVArh"},
    "0x0601" : {TYPE : 'F64', NAME : "importReactiveEnergyL1", UNIT : "kVArh"},
    "0x0602" : {TYPE : 'F64', NAME : "importReactiveEnergyL2", UNIT : "kVArh"},
    "0x0603" : {TYPE : 'F64', NAME : "importReactiveEnergyL3", UNIT : "kVArh"},
    "0x0610" : {TYPE : 'F64', NAME : "importReactiveEnergySystemT1", UNIT : "kVArh"},
    "0x0611" : {TYPE : 'F64', NAME : "importReactiveEnergyL1T1", UNIT : "kVArh"},
    "0x0612" : {TYPE : 'F64', NAME : "importReactiveEnergyL2T1", UNIT : "kVArh"},
    "0x0613" : {TYPE : 'F64', NAME : "importReactiveEnergyL3T1", UNIT : "kVArh"},
    "0x0620" : {TYPE : 'F64', NAME : "importReactiveEnergySystemT2", UNIT : "kVArh"},
    "0x0621" : {TYPE : 'F64', NAME : "importReactiveEnergyL1T2", UNIT : "kVArh"},
    "0x0622" : {TYPE : 'F64', NAME : "importReactiveEnergyL2T2", UNIT : "kVArh"},
    "0x0623" : {TYPE : 'F64', NAME : "importReactiveEnergyL3T2", UNIT : "kVArh"},
    "0x0630" : {TYPE : 'F64', NAME : "importReactiveEnergySystemT3", UNIT : "kVArh"},
    "0x0631" : {TYPE : 'F64', NAME : "importReactiveEnergyL1T3", UNIT : "kVArh"},
    "0x0632" : {TYPE : 'F64', NAME : "importReactiveEnergyL2T3", UNIT : "kVArh"},
    "0x0633" : {TYPE : 'F64', NAME : "importReactiveEnergyL3T3", UNIT : "kVArh"},
    "0x0640" : {TYPE : 'F64', NAME : "importReactiveEnergySystemT4", UNIT : "kVArh"},
    "0x0641" : {TYPE : 'F64', NAME : "importReactiveEnergyL1T4", UNIT : "kVArh"},
    "0x0642" : {TYPE : 'F64', NAME : "importReactiveEnergyL2T4", UNIT : "kVArh"},
    "0x0643" : {TYPE : 'F64', NAME : "importReactiveEnergyL3T4", UNIT : "kVArh"},
    "0x06A0" : {TYPE : 'F64', NAME : "importReactiveEnergySystemPartial", UNIT : "kVArh"},
    "0x06A1" : {TYPE : 'F64', NAME : "importReactiveEnergyL1Partial", UNIT : "kVArh"},
    "0x06A2" : {TYPE : 'F64', NAME : "importReactiveEnergyL2Partial", UNIT : "kVArh"},
    "0x06A3" : {TYPE : 'F64', NAME : "importReactiveEnergyL3Partial", UNIT : "kVArh"},

    "0x0700" : {TYPE : 'F64', NAME : "exportReactiveEnergySystem", UNIT : "kVArh"},
    "0x0701" : {TYPE : 'F64', NAME : "exportReactiveEnergyL1", UNIT : "kVArh"},
    "0x0702" : {TYPE : 'F64', NAME : "exportReactiveEnergyL2", UNIT : "kVArh"},
    "0x0703" : {TYPE : 'F64', NAME : "exportReactiveEnergyL3", UNIT : "kVArh"},
    "0x0710" : {TYPE : 'F64', NAME : "exportReactiveEnergySystemT1", UNIT : "kVArh"},
    "0x0711" : {TYPE : 'F64', NAME : "exportReactiveEnergyL1T1", UNIT : "kVArh"},
    "0x0712" : {TYPE : 'F64', NAME : "exportReactiveEnergyL2T1", UNIT : "kVArh"},
    "0x0713" : {TYPE : 'F64', NAME : "exportReactiveEnergyL3T1", UNIT : "kVArh"},
    "0x0720" : {TYPE : 'F64', NAME : "exportReactiveEnergySystemT2", UNIT : "kVArh"},
    "0x0721" : {TYPE : 'F64', NAME : "exportReactiveEnergyL1T2", UNIT : "kVArh"},
    "0x0722" : {TYPE : 'F64', NAME : "exportReactiveEnergyL2T2", UNIT : "kVArh"},
    "0x0723" : {TYPE : 'F64', NAME : "exportReactiveEnergyL3T2", UNIT : "kVArh"},
    "0x0730" : {TYPE : 'F64', NAME : "exportReactiveEnergySystemT3", UNIT : "kVArh"},
    "0x0731" : {TYPE : 'F64', NAME : "exportReactiveEnergyL1T3", UNIT : "kVArh"},
    "0x0732" : {TYPE : 'F64', NAME : "exportReactiveEnergyL2T3", UNIT : "kVArh"},
    "0x0733" : {TYPE : 'F64', NAME : "exportReactiveEnergyL3T3", UNIT : "kVArh"},
    "0x0740" : {TYPE : 'F64', NAME : "exportReactiveEnergySystemT4", UNIT : "kVArh"},
    "0x0741" : {TYPE : 'F64', NAME : "exportReactiveEnergyL1T4", UNIT : "kVArh"},
    "0x0742" : {TYPE : 'F64', NAME : "exportReactiveEnergyL2T4", UNIT : "kVArh"},
    "0x0743" : {TYPE : 'F64', NAME : "exportReactiveEnergyL3T4", UNIT : "kVArh"},
    "0x07A0" : {TYPE : 'F64', NAME : "exportReactiveEnergySystemPartial", UNIT : "kVArh"},
    "0x07A1" : {TYPE : 'F64', NAME : "exportReactiveEnergyL1Partial", UNIT : "kVArh"},
    "0x07A2" : {TYPE : 'F64', NAME : "exportReactiveEnergyL2Partial", UNIT : "kVArh"},
    "0x07A3" : {TYPE : 'F64', NAME : "exportReactiveEnergyL3Partial", UNIT : "kVArh"},

    "0x0800" : {TYPE : 'F64', NAME : "activeEnergyBalanceSystem", UNIT : "kWh"},
    "0x0801" : {TYPE : 'F64', NAME : "activeEnergyBalanceL1", UNIT : "kWh"},
    "0x0802" : {TYPE : 'F64', NAME : "activeEnergyBalanceL2", UNIT : "kWh"},
    "0x0803" : {TYPE : 'F64', NAME : "activeEnergyBalanceL3", UNIT : "kWh"},

    "0x08F0" : {TYPE : 'F64', NAME : "reactiveEnergyBalanceSystem", UNIT : "kVArh"},
    "0x08F1" : {TYPE : 'F64', NAME : "reactiveEnergyBalanceL1", UNIT : "kVArh"},
    "0x08F2" : {TYPE : 'F64', NAME : "reactiveEnergyBalanceL2", UNIT : "kVArh"},
    "0x08F3" : {TYPE : 'F64', NAME : "reactiveEnergyBalanceL3", UNIT : "kVArh"},

    "0xA100" : {TYPE : 'F64', NAME : "reactiveEnergyZone1System", UNIT : "kVArh"},
    "0xA101" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L1", UNIT : "kVArh"},
    "0xA102" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L2", UNIT : "kVArh"},
    "0xA103" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L3", UNIT : "kVArh"},
    "0xA110" : {TYPE : 'F64', NAME : "reactiveEnergyZone1SystemT1", UNIT : "kVArh"},
    "0xA111" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L1T1", UNIT : "kVArh"},
    "0xA112" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L2T1", UNIT : "kVArh"},
    "0xA113" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L3T1", UNIT : "kVArh"},
    "0xA120" : {TYPE : 'F64', NAME : "reactiveEnergyZone1SystemT2", UNIT : "kVArh"},
    "0xA121" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L1T2", UNIT : "kVArh"},
    "0xA122" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L2T2", UNIT : "kVArh"},
    "0xA123" : {TYPE : 'F64', NAME : "reactiveEnergyZone1L3T2", UNIT : "kVArh"},

    "0xA200" : {TYPE : 'F64', NAME : "reactiveEnergyZone2System", UNIT : "kVArh"},
    "0xA201" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L1", UNIT : "kVArh"},
    "0xA202" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L2", UNIT : "kVArh"},
    "0xA203" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L3", UNIT : "kVArh"},
    "0xA210" : {TYPE : 'F64', NAME : "reactiveEnergyZone2SystemT1", UNIT : "kVArh"},
    "0xA211" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L1T1", UNIT : "kVArh"},
    "0xA212" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L2T1", UNIT : "kVArh"},
    "0xA213" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L3T1", UNIT : "kVArh"},
    "0xA220" : {TYPE : 'F64', NAME : "reactiveEnergyZone2SystemT2", UNIT : "kVArh"},
    "0xA221" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L1T2", UNIT : "kVArh"},
    "0xA222" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L2T2", UNIT : "kVArh"},
    "0xA223" : {TYPE : 'F64', NAME : "reactiveEnergyZone2L3T2", UNIT : "kVArh"},

    "0xA300" : {TYPE : 'F64', NAME : "reactiveEnergyZone3System", UNIT : "kVArh"},
    "0xA301" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L1", UNIT : "kVArh"},
    "0xA302" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L2", UNIT : "kVArh"},
    "0xA303" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L3", UNIT : "kVArh"},
    "0xA310" : {TYPE : 'F64', NAME : "reactiveEnergyZone3SystemT1", UNIT : "kVArh"},
    "0xA311" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L1T1", UNIT : "kVArh"},
    "0xA312" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L2T1", UNIT : "kVArh"},
    "0xA313" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L3T1", UNIT : "kVArh"},
    "0xA320" : {TYPE : 'F64', NAME : "reactiveEnergyZone3SystemT2", UNIT : "kVArh"},
    "0xA321" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L1T2", UNIT : "kVArh"},
    "0xA322" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L2T2", UNIT : "kVArh"},
    "0xA323" : {TYPE : 'F64', NAME : "reactiveEnergyZone3L3T2", UNIT : "kVArh"},

    "0xA400" : {TYPE : 'F64', NAME : "reactiveEnergyZone4System", UNIT : "kVArh"},
    "0xA401" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L1", UNIT : "kVArh"},
    "0xA402" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L2", UNIT : "kVArh"},
    "0xA403" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L3", UNIT : "kVArh"},
    "0xA410" : {TYPE : 'F64', NAME : "reactiveEnergyZone4SystemT1", UNIT : "kVArh"},
    "0xA411" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L1T1", UNIT : "kVArh"},
    "0xA412" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L2T1", UNIT : "kVArh"},
    "0xA413" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L3T1", UNIT : "kVArh"},
    "0xA420" : {TYPE : 'F64', NAME : "reactiveEnergyZone4SystemT2", UNIT : "kVArh"},
    "0xA421" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L1T2", UNIT : "kVArh"},
    "0xA422" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L2T2", UNIT : "kVArh"},
    "0xA423" : {TYPE : 'F64', NAME : "reactiveEnergyZone4L3T2", UNIT : "kVArh"},

    "0x2100" : {TYPE: 'FLAG32', NAME: "digitalInputFlags",
        FLAGS: [
            { NAME : "digitalInput1Flag", BIT: 0, FALSE: "NO_ERROR", TRUE: "ERROR"},
            { NAME : "digitalInput2Flag", BIT: 1, FALSE: "NO_ERROR", TRUE: "ERROR"}
        ]
    },
    "0x2110" : {TYPE : 'U32', NAME : "digitalInput1Counter"},
    "0x2111" : {TYPE : 'U32', NAME : "digitalInput1OnTime"},
    "0x2120" : {TYPE : 'U32', NAME : "digitalInput2Counter"},
    "0x2121" : {TYPE : 'U32', NAME : "digitalInput2OnTime"},

    "0xEEA0" : {TYPE: 'FLAG32', NAME: "diagnosticAlarms",
        FLAGS: [
            { NAME : "alarmLowVoltageLN", BIT: 0, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmLowCurrent", BIT: 1, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmLowActivePower", BIT: 2, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmLowReactivePower", BIT: 3, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmLowApparentPower", BIT: 4, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmLowPowerFactor", BIT: 5, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmLowFrequency", BIT: 6, FALSE: "NO_ALARM", TRUE: "ALARM"},

            { NAME : "alarmHighVoltageLN", BIT: 16, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmHighCurrent", BIT: 17, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmHighActivePower", BIT: 18, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmHighReactivePower", BIT: 19, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmHighApparentPower", BIT: 20, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmHighPowerFactor", BIT: 21, FALSE: "NO_ALARM", TRUE: "ALARM"},
            { NAME : "alarmHighFrequency", BIT: 22, FALSE: "NO_ALARM", TRUE: "ALARM"}
        ]
    },
    "0xEEE0" : {TYPE: 'FLAG32', NAME: "diagnosticErrorFlags",
        FLAGS: [
            { NAME : "pulse1ErrorFlag", BIT: 0, FALSE: "NO_ERROR", TRUE: "ERROR"},
            { NAME : "pulse2ErrorFlag", BIT: 1, FALSE: "NO_ERROR", TRUE: "ERROR"},
            { NAME : "phaseSequenceErrorFlag", BIT: 2, FALSE: "NO_ERROR", TRUE: "ERROR"},
            { NAME : "currentDirectionErrorFlag", BIT: 3, FALSE: "NO_ERROR", TRUE: "ERROR"}
        ]
    }
};


function decodeRegisters(bytes)
{
    var decoded = {};
    var index = 0;
    while(index+2 < bytes.length)
    {
        var regAddr = getRegAddr(bytes, index);;
        index = index + 2;
        var reg = getRegister(regAddr)
        if(reg == null){
            index = " at index " + (index - 1);
            decoded[UPLINK.ERROR_NAME] = UPLINK.ERRORS.REGISTER + regAddr + index;
            return decoded;
        }
        // Decoding
        reg.INDEX = index;
        reg = decodeRegister(bytes, reg);
        if(reg.SIZE == 0){
            index = " at index " + (index - 1);
            decoded[UPLINK.ERROR_NAME] = UPLINK.ERRORS.REGISTER + regAddr + index;
            return decoded;
        }
        decoded[reg.NAME] = reg.DATA;
        index = index + reg.SIZE;
    }
    return decoded;
}

function decodeFmpAnswers(bytes)
{
    var decoded = {};
    var index = 0;
    while (index < bytes.length) {
        var cid = bytes[index];
        index = index + 1;
        if(cid > 5){
            return decoded;
        }
        if(cid == 0){
            var ans1 = {};
            ans1.id = bytes[index];
            index = index + 1;
            ans1.version = bytes[index];
            index = index + 1;
            decoded.fmpPackageVersionAns = ans1;
        }
        else if(cid == 1){
            var ans2 = {};
            ans2.firmware = decodeFmpVersionAns(bytes, index);
            index = index + 4;
            ans2.hardware = decodeFmpVersionAns(bytes, index);
            index = index + 4;
            decoded.fmpDevVersionAns = ans2;
        }
        else if (cid == 2) {
            decoded.fmpDevRebootTimeAns = getUnsignedLittleEndian(bytes, index, 4);
            index = index + 4;
        }
        else if (cid == 3) {
            decoded.fmpDevRebootCountdownAns = getUnsignedLittleEndian(bytes, index, 3);
            index = index + 3;
        }
        else if (cid == 4) {
            var ans5 = {};
            var fwStatus = bytes[index];
            index = index + 1;
            if (fwStatus == 0) {
                ans5.status = "NO_FIRMWARE_UPGRADE_IMAGE";
            } else if(fwStatus == 1) {
                ans5.status = "FIRMWARE_UPGRADE_IMAGE_INVALID";
            } else if(fwStatus == 2) {
                ans5.status = "FIRMWARE_UPGRADE_IMAGE_MISMATCH";
            } else if(fwStatus == 3) {
                ans5 = decodeFmpVersionAns(bytes, index);
                index = index + 4;
                ans5.status = "FIRMWARE_UPGRADE_IMAGE_VALID";
            }
            decoded.fmpDevUpgradeImageAns = ans5;
        }
        else if (cid == 5) {
            var status = bytes[index];
            index = index + 1;
            var ans6 = {};
            if(status != 0){
                ans6.status = status;
                ans6.meaning = "DELETE_IMAGE_FAILED";
            } else {
                ans6.status = status;
                ans6.meaning = "DELETE_IMAGE_SUCCESS";
            }
            decoded.fmpDevDeleteImageAns = ans6;
        }
    }
    return decoded;
}


function decodeMaxDemandHistoricData(bytes)
{
    var decoded = {};
    // package timestamp
    var index = 2; // skip addr of packageTimestamp
    var packageTimestamp = getUnsignedBigEndian(bytes, index, 4);
    var listOfMeasurements = [];
    index = index + 4;
    while(index + 2 < bytes.length)
    {
        var regAddr = getRegAddr(bytes, index);
        index = index + 2;
        var reg = getRegister(regAddr);
        if(reg == null){
            index = " at index " + (index - 1);
            decoded[UPLINK.ERROR_NAME] = UPLINK.ERRORS.REGISTER + regAddr + index;
            return decoded;
        }
        var logItem = {};
        var delta = getUnsignedBigEndian(bytes, index, 2);
        delta = delta * 60;
        index = index + 2;
        // Decoding
        reg.INDEX = index;
        reg = decodeRegister(bytes, reg);
        logItem.name = reg.NAME;
        logItem.data = reg.DATA;
        if(reg.ALIAS){
            logItem.alias = reg.ALIAS;
        }
        logItem.ts = packageTimestamp - delta;
        index = index + reg.SIZE;
        listOfMeasurements.push(logItem);
    }
    decoded.packageTimestamp = packageTimestamp;
    decoded.listOfMeasurements = listOfMeasurements;
    return decoded;
}


/**  Helper functions  **/

/**
 * 
 * @param {Array} bytes uplink bytes
 * @param {Number} index current index in bytes
 * @returns {String} register address in hex (eg: 0x0002)
 */
function getRegAddr(bytes, index)
{
    return '0x' + byteToEvenHEX(bytes[index]) + byteToEvenHEX(bytes[index+1]);
}

/**
 * @brief Get a register information for a given register address
 * @param {String} regAddr register address
 * @returns {Object|null} register information or null if not found
 */
function getRegister(regAddr)
{
    if(regAddr in DEVICE_GENERIC_REGISTERS){
        return DEVICE_GENERIC_REGISTERS[regAddr];
    }
    if(regAddr in DEVICE_SPECIFIC_REGISTERS){
        return DEVICE_SPECIFIC_REGISTERS[regAddr];
    }
    return null;
}

/**
 * @brief Decodes a single register
 * @param {Array[number]} bytes uplink bytes
 * @param {Object} reg register information
 * @returns {Object} decoded register
 */
function decodeRegister(bytes, reg)
{
    var data;
    switch (reg.TYPE) {
    case 'VER':{
        reg.SIZE = 2;
        // Decode into "v" + DIGIT STRING + "." DIGIT STRING format
        data = getHexString(bytes, reg.INDEX, reg.SIZE);
        data = "v" + data[0] + "." + data[1];
        reg.DATA = data;
        return reg;
    }
    case 'ENUM':{
        reg.SIZE = 1;
        // Decode into HEX byte (VALUES specified in reg.VALUES)
        data = "0x" + byteToEvenHEX(bytes[reg.INDEX]);
        data = reg.VALUES[data];
        reg.DATA = data;
        return reg;
    }
    case 'STR':{
        // first byte is the data size
        reg.SIZE = bytes[reg.INDEX];
        reg.INDEX = reg.INDEX + 1;
        // Decode into STRING format
        data = getString(bytes, reg.INDEX, reg.SIZE);
        // account for data size byte
        reg.SIZE = reg.SIZE + 1;
        reg.DATA = data;
        return reg;
    }
    case 'U8':
    case 'U16':
    case 'U32':
    case 'U64':{
        if(reg.TYPE === 'U8'){
            reg.SIZE = 1;
        } else if(reg.TYPE === 'U16'){
            reg.SIZE = 2;
        } else if(reg.TYPE === 'U32'){
            reg.SIZE = 4;
        } else if(reg.TYPE === 'U64'){
            reg.SIZE = 8;
        }
        data = getUnsignedBigEndian(bytes, reg.INDEX, reg.SIZE);
        if(reg.RESOLUTION){
            data = data * reg.RESOLUTION;
            data = parseFloat(data.toFixed(3));
        }
        reg.DATA = data;
        return reg;
    }
    case 'I8':
    case 'I16':
    case 'I32':
    case 'I64':{
        if(reg.TYPE === 'I8'){
            reg.SIZE = 1;
        } else if(reg.TYPE === 'I16'){
            reg.SIZE = 2;
        } else if(reg.TYPE === 'I32'){
            reg.SIZE = 4;
        } else if(reg.TYPE === 'I64'){
            reg.SIZE = 8;
        }
        data = getUnsignedBigEndian(bytes, reg.INDEX, reg.SIZE);
        data = getSigned(data, reg.SIZE);
        if(reg.RESOLUTION){
            data = data * reg.RESOLUTION;
            data = parseFloat(data.toFixed(3));
        }
        reg.DATA = data;
        return reg;
    }
    case 'F32':{
        reg.SIZE = 4;
        data = getFloat32(bytes, reg.INDEX);
        if(data != null){
            if(reg.RESOLUTION){
                data = data * reg.RESOLUTION;
            }
            data = parseFloat(data.toFixed(3));
        }
        reg.DATA = data;
        return reg;
    }
    case 'F64':{
        reg.SIZE = 8;
        data = getFloat64(bytes, reg.INDEX);
        if(data != null){
            if(reg.RESOLUTION){
                data = data * reg.RESOLUTION;
            }
            data = parseFloat(data.toFixed(6));
        }
        reg.DATA = data;
        return reg;
    }
    case 'FLAG8':
    case 'FLAG16':
    case 'FLAG32':{
        if(reg.TYPE === 'FLAG8'){
            reg.SIZE = 1;
        } else if(reg.TYPE === 'FLAG16'){
            reg.SIZE = 2;
        } else if(reg.TYPE === 'FLAG32'){
            reg.SIZE = 4;
        }
        data = getUnsignedBigEndian(bytes, reg.INDEX, reg.SIZE);
        reg.DATA = getFlags(data, reg.FLAGS);
        return reg;
    }
    default:
        break;
    }
    reg.SIZE = 0;
    reg.DATA = null;
    return reg;
}

function decodeFmpVersionAns(bytes, index)
{
    var ans = {};
    // little endian
    ans.major = bytes[index+3];
    ans.minor = bytes[index+2];
    ans.revision = (bytes[index+1] << 8) + bytes[index];
    ans.version = "v" + ans.major + "." + ans.minor + "." + ans.revision;
    return ans;
}

function getString(bytes, index, size)
{
    var value = "";
    for(var i=0; i<size; i=i+1)
    {
        value = value + String.fromCharCode(bytes[index+i]);
    }
    return value;
}

function getUnsignedBigEndian(bytes, index, size)
{
    var value = 0;
    for(var i=0; i<(size-1); i=i+1)
    {
        value = (value | bytes[index+i]) << 8; 
    }
    value = value | bytes[index+size-1];
    return (value >>> 0); // to unsigned
}

function getUnsignedLittleEndian(bytes, index, size)
{
    var value = 0;
    for(var i=(size-1); i>0; i=i-1)
    {
        value = (value | bytes[index+i]) << 8; 
    }
    value = value | bytes[index];
    return (value >>> 0); // to unsigned
}


function getHexString(bytes, index, size)
{
  var hexString = [];
  for(var i=0; i<size; i=i+1)
  {
    hexString.push(bytes[index+i].toString(16));
  }
  return hexString;
}

function getHexStringEven(bytes, index, size)
{
  var hexString = [];
  for(var i=0; i<size; i=i+1)
  {
    hexString.push(bytes[index+i].toString(16));
  }
  return hexString.map(toEvenHEX);
}

function toEvenHEX(hex)
{
  if(hex.length == 1)
  {
    return "0"+hex;
  }
  return hex;
}

function byteToEvenHEX(singleByte)
{
    return toEvenHEX(singleByte.toString(16).toUpperCase());
}

function getSigned(unsigned, size) 
{
    var signMask = 1 << (size * 8 - 1);
    var dataMask = (1 << (size * 8 - 1)) - 1;
    if(unsigned & signMask) 
    {
        return -(~unsigned & dataMask) - 1;
    }else 
    {
        return unsigned & dataMask;
    }
}

function getBit(val, idx)
{
    var bitMask = 0x01 << idx;
    if(val & bitMask)
    {
        return true;
    }
    return false;
}

function getFlags(val, possibleFlags)
{
    var flags = {};
    for(var i=0; i<possibleFlags.length; i=i+1)
    {
        var flag = possibleFlags[i];
        flags[flag.NAME] = flag[getBit(val, flag.BIT).toString()];
    }
    return flags;
}

/**
 * @brief Convert bytes to IEEE float32
 * @param {Array} bytes uplink bytes
 * @param {Number} index current index in bytes
 * @returns {Number | null} float32 number or null
 * @compatibility This is compatible with old JS engine (ES3/ES4)
 */
function getFloat32(bytes, index) {
    var b0 = bytes[index];
    var b1 = bytes[index+1];
    var b2 = bytes[index+2];
    var b3 = bytes[index+3];

    var bits = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;

    var sign = (bits >>> 31) ? -1 : 1;
    var exponent = (bits >>> 23) & 0xFF;
    var mantissa = bits & 0x7FFFFF;

    if (exponent === 0xFF) {
        // mantissa ? NaN : sign * Infinity;
        return null;
    }

    if (exponent === 0) {
        return sign * mantissa * Math.pow(2, -149);
    }

    return sign * (1 + mantissa / 0x800000) * Math.pow(2, exponent - 127);
}

/**
 * @brief Convert bytes to IEEE float64
 * @param {Array} bytes uplink bytes
 * @param {Number} index current index in bytes
 * @returns {Number | null} float64 number or null
 * @compatibility This is compatible with old JS engine (ES3/ES4)
 */
function getFloat64(bytes, index) {
    var hi = (bytes[index] * 0x1000000) + (bytes[index+1] << 16) +
            (bytes[index+2] << 8) + bytes[index+3];
    var lo = (bytes[index+4] * 0x1000000) + (bytes[index+5] << 16) +
            (bytes[index+6] << 8) + bytes[index+7];

    var sign = (hi >>> 31) ? -1 : 1;
    var exponent = (hi >>> 20) & 0x7FF;

    var mantissaHigh = hi & 0xFFFFF;
    var mantissa = mantissaHigh * Math.pow(2, 32) + lo;

    if (exponent === 0x7FF) {
        // mantissa ? NaN : sign * Infinity;
        return null;
    }

    if (exponent === 0) {
        return sign * mantissa * Math.pow(2, -1074);
    }

    return sign *
           (1 + mantissa / Math.pow(2, 52)) *
           Math.pow(2, exponent - 1023);
}

/************************************************************************************************************/

// Decode decodes an array of bytes into an object. (ChirpStack v3)
//  - fPort contains the LoRaWAN fPort number
//  - bytes is an array of bytes, e.g. [225, 230, 255, 0]
//  - variables contains the device variables e.g. {"calibration": "3.5"} (both the key / value are of type string)
// The function must return an object, e.g. {"temperature": 22.5}
function Decode(fPort, bytes, variables) 
{
    var decoded = {};
    if(fPort == 0){
        decoded = {mac: UPLINK.MAC.MSG, fPort: fPort};
    }else if(fPort >= UPLINK.FUOTA.FPORT_MIN && fPort <= UPLINK.FUOTA.FPORT_MAX){
        decoded[UPLINK.INFO_NAME] = UPLINK.FUOTA.MSG;
    }else if(fPort == UPLINK.FMP.FPORT){
        decoded = decodeFmpAnswers(bytes);
        decoded[UPLINK.INFO_NAME] = UPLINK.FMP.MSG;
    }else if(bytes.length == 1){
        if(bytes[0] == 0){
            decoded[UPLINK.INFO_NAME] = UPLINK.DOWNLINK.SUCCESS;
        }else if(bytes[0] == 1){
            decoded[UPLINK.WARNING_NAME] = UPLINK.DOWNLINK.FAILURE;
        } 
    }else if(fPort >= UPLINK.GENERIC_DATA.FPORT_MIN && fPort <= UPLINK.GENERIC_DATA.FPORT_MAX){
        decoded = decodeRegisters(bytes);
    }else if(fPort >= UPLINK.DEVICE_DATA.FPORT_MIN && fPort <= UPLINK.DEVICE_DATA.FPORT_MAX){
        decoded = decodeRegisters(bytes);
    }else if(fPort == UPLINK.ALARM_DATA.FPORT){
        decoded = decodeRegisters(bytes);
    }else if(fPort == UPLINK.MAX_DEMAND_DATA.FPORT){
        decoded = decodeMaxDemandHistoricData(bytes);
    }else if(fPort == UPLINK.PARAMETER_DATA.FPORT){
        decoded = decodeRegisters(bytes);
    }else{
        decoded.fPort = fPort;
        decoded[UPLINK.ERROR_NAME] = UPLINK.ERRORS.FPORT_INCORRECT;
    }
    decoded[VERSION_CONTROL.CODEC.NAME] = VERSION_CONTROL.CODEC.VERSION;
    decoded[VERSION_CONTROL.DEVICE.NAME] = VERSION_CONTROL.DEVICE.MODEL;
    decoded[VERSION_CONTROL.PRODUCT.NAME] = VERSION_CONTROL.PRODUCT.CODE;
    decoded[VERSION_CONTROL.MANUFACTURER.NAME] = VERSION_CONTROL.MANUFACTURER.COMPANY;
    return decoded;
}

// Decode uplink function. (ChirpStack v4, TTN, TTI, LORIOT, ThingPark)
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.
function decodeUplink(input) {
    var errors = [];
    var warnings = [];
    var decoded = Decode(input.fPort, input.bytes, input.variables);
    if(UPLINK.ERROR_NAME in decoded){
        errors.push(decoded[UPLINK.ERROR_NAME]);
    }
    if(UPLINK.WARNING_NAME in decoded){
        warnings.push(decoded[UPLINK.WARNING_NAME]);
    }
    return {
        data: decoded,
        errors: errors,
        warnings: warnings
    };
}

/*************************************************************************************************************/
// Constants for device downlink 
var DEVICE = {

    DOWNLINK : {
        TYPE    : "Type",
        CONFIG  : "Config",
        PERIODIC: "Periodic",
        READING : "Reading"
    },
    CONFIG : {
        FPORT: 50,
        CHANNEL : 0xFF,
        REG_MIN_NUMBER : 1,  // downlink min number of registers
        REG_MAX_NUMBER : 10  // downlink max number of registers
    },
    PERIODIC : {
        FPORT_MIN: 1,
        FPORT_MAX: 10,
        CHANNEL : 0xFF,
        INTERVAL_TYPE : 0x14,
        MODE_TYPE : 0x15,
        STATUS_TYPE : 0x16,
        REGISTERS_TYPE : 0x17,
        REG_MIN_NUMBER : 1,  // downlink min number of registers
        REG_MAX_NUMBER : 10  // downlink max number of registers
    },
    READING: {
        FPORT: 100,
        CHANNEL : 0xFF,
        TYPE : 0xCC,
        REG_MIN_NUMBER : 1,  // downlink min number of registers
        REG_MAX_NUMBER : 10  // downlink max number of registers
    },

    REGISTERS : {
        /* device registers */
        // SIZE, MIN and MAX are required if the register is writable (RW permission is "W" or "RW")
        // "registerName": {ADDR: <address>, RW: <"R"/"W"/"RW">, SIZE: <data_size>, MIN: <min>, MAX: <max> }

        /* generic registers */
        "buildingName": {ADDR: 0xFF32, SIZE: 0, RW:"R"},
        "buildingRoom": {ADDR: 0xFF33, SIZE: 0, RW:"R"},
        "deviceName": {ADDR: 0xFF34, SIZE: 0, RW:"R"},
        "deviceStatus": {ADDR: 0xFF64, RW:"R"},
        "manufacturer": {ADDR: 0xFF65, RW:"R"},
        "originalEquipmentManufacturer": {ADDR: 0xFF66, RW:"R"},
        "deviceModel": {ADDR: 0xFF67, RW:"R"},
        "deviceSerialNumber": {ADDR: 0xFF68, RW:"R"},
        "firmwareVersion": {ADDR: 0xFF69, RW:"R"},
        "hardwareVersion": {ADDR: 0xFF6A, RW:"R"},
        "externalPowerStatus": {ADDR: 0xFF6B, RW:"R"},
        "batteryVoltage": {ADDR: 0xFF6C, RW:"R"},
        "batteryPercentage": {ADDR: 0xFF6D, RW:"R"},
        // skip ADDR 0xFF6E
        "rebootDevice": {ADDR: 0xFF6F, SIZE: 1, MIN: 1, MAX: 1, RW:"W"},

        "internalCircuitTemperatureAlarm": {ADDR: 0xFF78, RW:"R"},
        "internalCircuitTemperatureNumberOfAlarms": {ADDR: 0xFF79, RW:"R"},
        "internalCircuitTemperature": {ADDR: 0xFF7A, RW:"R"},
        "internalCircuitHumidity": {ADDR: 0xFF7B, RW:"R"},

        "ambientTemperature": {ADDR: 0xFF82, RW:"R"},
        "ambientHumidity": {ADDR: 0xFF83, RW:"R"},

        "restartLoRaWAN": {ADDR: 0xFF95, SIZE: 1, MIN: 1, MAX: 1, RW:"W"},
        "joinStatus": {ADDR: 0xFF96, RW:"R"},
        "radioModule": {ADDR: 0xFF97, RW:"R"},
        "lorawanRegion": {ADDR: 0xFF98, SIZE: 1, MIN: 0, MAX: 3, RW:"RW"},
        "lorawanVersion": {ADDR: 0xFF99, RW:"R"},
        
        "applicationPort": {ADDR: 0xFF9D, SIZE: 1, MIN: 50, MAX: 99, RW:"RW"},
        "joinType": {ADDR: 0xFF9E, RW:"RW"},
        "deviceClass": {ADDR: 0xFF9F, RW:"RW"},
        "adr": {ADDR: 0xFFA0, SIZE: 1, MIN: 0, MAX: 1, RW:"RW"},
        "sf": {ADDR: 0xFFA1, SIZE: 1, MIN: 0, MAX: 6, RW:"RW"},
        "adrProfile": {ADDR: 0xFFA2, SIZE: 1, MIN: 0, MAX: 2, RW:"RW"},
        "radioMode": {ADDR: 0xFFA3, SIZE: 1, MIN: 0, MAX: 2, RW:"RW"},
        "numberOfJoinAttempts": {ADDR: 0xFFA4, SIZE: 1, MIN: 0, MAX: 0xFF, RW:"RW"},
        "linkCheckTimeframe": {ADDR: 0xFFA5, SIZE: 2, MIN: 1, MAX: 0xFFFF, RW:"RW"},
        "dataRetransmission": {ADDR: 0xFFA6, SIZE: 1, MIN: 0, MAX: 1, RW:"RW"},
        "lorawanWatchdogAlarm": {ADDR: 0xFFA7, SIZE: 1, MIN: 0, MAX: 1, RW:"R"},


        /* specific registers */
        "electricalCabinet": {ADDR: 0xEE3C, SIZE: 0, RW: "RW"},
        "electricalGroup": {ADDR: 0xEE3D, SIZE: 0, RW: "RW"},
        "serialWatchdogAlarm": {ADDR: 0x6000, RW: "R"},
        "serialModbusSlaveId": {ADDR: 0x6001, SIZE: 1, MIN: 1, MAX: 247, RW: "RW"},
        "serialStopBits": {ADDR: 0x6002, RW: "R"},
        "serialParity": {ADDR: 0x6003, RW: "R"},
        "serialDataWidth": {ADDR: 0x6004, RW: "R"},
        "serialBaudRate": {ADDR: 0x6005, RW: "R"},
        "serialModbusExecutionInterval": {ADDR: 0x6009, SIZE: 2, MIN: 50, MAX: 60000, RW: "RW"},
        "serialModbusResponseTimeout": {ADDR: 0x600A, SIZE: 2, MIN: 10, MAX: 60000, RW: "RW"},
        "serialModbusMaxRetries": {ADDR: 0x600C, SIZE: 1, MIN: 1, MAX: 5, RW: "RW"},
        "frequency": {ADDR: 0x0000, RW: "R"},
        "phaseSequence": {ADDR: 0x0010, RW: "R"},
        "voltageAvgLN": {ADDR: 0x0100, RW: "R"},
        "voltageL1N": {ADDR: 0x0101, RW: "R"},
        "voltageL2N": {ADDR: 0x0102, RW: "R"},
        "voltageL3N": {ADDR: 0x0103, RW: "R"},
        "voltageL1L2": {ADDR: 0x0104, RW: "R"},
        "voltageL2L3": {ADDR: 0x0105, RW: "R"},
        "voltageL3L1": {ADDR: 0x0106, RW: "R"},
        "voltageAvgLL": {ADDR: 0x0107, RW: "R"},
        "voltageThdL1": {ADDR: 0x0111, RW: "R"},
        "voltageThdL2": {ADDR: 0x0112, RW: "R"},
        "voltageThdL3": {ADDR: 0x0113, RW: "R"},
        "currentTotal": {ADDR: 0x0200, RW: "R"},
        "currentL1": {ADDR: 0x0201, RW: "R"},
        "currentL2": {ADDR: 0x0202, RW: "R"},
        "currentL3": {ADDR: 0x0203, RW: "R"},
        "currentNeutral": {ADDR: 0x0204, RW: "R"},
        "currentThdL1": {ADDR: 0x0211, RW: "R"},
        "currentThdL2": {ADDR: 0x0212, RW: "R"},
        "currentThdL3": {ADDR: 0x0213, RW: "R"},
        "currentAvg": {ADDR: 0x0220, RW: "R"},
        "currentAvgL1": {ADDR: 0x0221, RW: "R"},
        "currentAvgL2": {ADDR: 0x0222, RW: "R"},
        "currentAvgL3": {ADDR: 0x0223, RW: "R"},
        "currentDemandTotal": {ADDR: 0x02D0, RW: "R"},
        "currentDemandL1": {ADDR: 0x02D1, RW: "R"},
        "currentDemandL2": {ADDR: 0x02D2, RW: "R"},
        "currentDemandL3": {ADDR: 0x02D3, RW: "R"},
        "currentMaxDemandTotal": {ADDR: 0x02E0, RW: "R"},
        "currentMaxDemandL1": {ADDR: 0x02E1, RW: "R"},
        "currentMaxDemandL2": {ADDR: 0x02E2, RW: "R"},
        "currentMaxDemandL3": {ADDR: 0x02E3, RW: "R"},
        "activePowerTotal": {ADDR: 0x0300, RW: "R"},
        "activePowerL1": {ADDR: 0x0301, RW: "R"},
        "activePowerL2": {ADDR: 0x0302, RW: "R"},
        "activePowerL3": {ADDR: 0x0303, RW: "R"},
        "activePowerImportDemand": {ADDR: 0x0310, RW: "R"},
        "activePowerExportDemand": {ADDR: 0x0320, RW: "R"},
        "activePowerImportMaxDemand": {ADDR: 0x0330, RW: "R"},
        "activePowerExportMaxDemand": {ADDR: 0x0340, RW: "R"},
        "reactivePowerTotal": {ADDR: 0x0350, RW: "R"},
        "reactivePowerL1": {ADDR: 0x0351, RW: "R"},
        "reactivePowerL2": {ADDR: 0x0352, RW: "R"},
        "reactivePowerL3": {ADDR: 0x0353, RW: "R"},
        "reactivePowerImportDemand": {ADDR: 0x0360, RW: "R"},
        "reactivePowerExportDemand": {ADDR: 0x0370, RW: "R"},
        "reactivePowerImportMaxDemand": {ADDR: 0x0380, RW: "R"},
        "reactivePowerExportMaxDemand": {ADDR: 0x0390, RW: "R"},
        "apparentPowerTotal": {ADDR: 0x03A0, RW: "R"},
        "apparentPowerL1": {ADDR: 0x03A1, RW: "R"},
        "apparentPowerL2": {ADDR: 0x03A2, RW: "R"},
        "apparentPowerL3": {ADDR: 0x03A3, RW: "R"},
        "apparentPowerDemand": {ADDR: 0x03B0, RW: "R"},
        "apparentPowerMaxDemand": {ADDR: 0x03C0, RW: "R"},
        "phaseAngleL1": {ADDR: 0x03D1, RW: "R"},
        "phaseAngleL2": {ADDR: 0x03D2, RW: "R"},
        "phaseAngleL3": {ADDR: 0x03D3, RW: "R"},
        "cosPhiL1": {ADDR: 0x03E1, RW: "R"},
        "cosPhiL2": {ADDR: 0x03E2, RW: "R"},
        "cosPhiL3": {ADDR: 0x03E3, RW: "R"},
        "powerFactorSystem": {ADDR: 0x03F0, RW: "R"},
        "powerFactorL1": {ADDR: 0x03F1, RW: "R"},
        "powerFactorL2": {ADDR: 0x03F2, RW: "R"},
        "powerFactorL3": {ADDR: 0x03F3, RW: "R"},
        "importActiveEnergySystem": {ADDR: 0x0400, RW: "R"},
        "importActiveEnergyL1": {ADDR: 0x0401, RW: "R"},
        "importActiveEnergyL2": {ADDR: 0x0402, RW: "R"},
        "importActiveEnergyL3": {ADDR: 0x0403, RW: "R"},
        "importActiveEnergySystemT1": {ADDR: 0x0410, RW: "R"},
        "importActiveEnergyL1T1": {ADDR: 0x0411, RW: "R"},
        "importActiveEnergyL2T1": {ADDR: 0x0412, RW: "R"},
        "importActiveEnergyL3T1": {ADDR: 0x0413, RW: "R"},
        "importActiveEnergySystemT2": {ADDR: 0x0420, RW: "R"},
        "importActiveEnergyL1T2": {ADDR: 0x0421, RW: "R"},
        "importActiveEnergyL2T2": {ADDR: 0x0422, RW: "R"},
        "importActiveEnergyL3T2": {ADDR: 0x0423, RW: "R"},
        "importActiveEnergySystemT3": {ADDR: 0x0430, RW: "R"},
        "importActiveEnergyL1T3": {ADDR: 0x0431, RW: "R"},
        "importActiveEnergyL2T3": {ADDR: 0x0432, RW: "R"},
        "importActiveEnergyL3T3": {ADDR: 0x0433, RW: "R"},
        "importActiveEnergySystemT4": {ADDR: 0x0440, RW: "R"},
        "importActiveEnergyL1T4": {ADDR: 0x0441, RW: "R"},
        "importActiveEnergyL2T4": {ADDR: 0x0442, RW: "R"},
        "importActiveEnergyL3T4": {ADDR: 0x0443, RW: "R"},
        "importActiveEnergySystemPartial": {ADDR: 0x04A0, RW: "R"},
        "importActiveEnergyL1Partial": {ADDR: 0x04A1, RW: "R"},
        "importActiveEnergyL2Partial": {ADDR: 0x04A2, RW: "R"},
        "importActiveEnergyL3Partial": {ADDR: 0x04A3, RW: "R"},
        "exportActiveEnergySystem": {ADDR: 0x0500, RW: "R"},
        "exportActiveEnergyL1": {ADDR: 0x0501, RW: "R"},
        "exportActiveEnergyL2": {ADDR: 0x0502, RW: "R"},
        "exportActiveEnergyL3": {ADDR: 0x0503, RW: "R"},
        "exportActiveEnergySystemT1": {ADDR: 0x0510, RW: "R"},
        "exportActiveEnergyL1T1": {ADDR: 0x0511, RW: "R"},
        "exportActiveEnergyL2T1": {ADDR: 0x0512, RW: "R"},
        "exportActiveEnergyL3T1": {ADDR: 0x0513, RW: "R"},
        "exportActiveEnergySystemT2": {ADDR: 0x0520, RW: "R"},
        "exportActiveEnergyL1T2": {ADDR: 0x0521, RW: "R"},
        "exportActiveEnergyL2T2": {ADDR: 0x0522, RW: "R"},
        "exportActiveEnergyL3T2": {ADDR: 0x0523, RW: "R"},
        "exportActiveEnergySystemT3": {ADDR: 0x0530, RW: "R"},
        "exportActiveEnergyL1T3": {ADDR: 0x0531, RW: "R"},
        "exportActiveEnergyL2T3": {ADDR: 0x0532, RW: "R"},
        "exportActiveEnergyL3T3": {ADDR: 0x0533, RW: "R"},
        "exportActiveEnergySystemT4": {ADDR: 0x0540, RW: "R"},
        "exportActiveEnergyL1T4": {ADDR: 0x0541, RW: "R"},
        "exportActiveEnergyL2T4": {ADDR: 0x0542, RW: "R"},
        "exportActiveEnergyL3T4": {ADDR: 0x0543, RW: "R"},
        "exportActiveEnergySystemPartial": {ADDR: 0x05A0, RW: "R"},
        "exportActiveEnergyL1Partial": {ADDR: 0x05A1, RW: "R"},
        "exportActiveEnergyL2Partial": {ADDR: 0x05A2, RW: "R"},
        "exportActiveEnergyL3Partial": {ADDR: 0x05A3, RW: "R"},
        "importReactiveEnergySystem": {ADDR: 0x0600, RW: "R"},
        "importReactiveEnergyL1": {ADDR: 0x0601, RW: "R"},
        "importReactiveEnergyL2": {ADDR: 0x0602, RW: "R"},
        "importReactiveEnergyL3": {ADDR: 0x0603, RW: "R"},
        "importReactiveEnergySystemT1": {ADDR: 0x0610, RW: "R"},
        "importReactiveEnergyL1T1": {ADDR: 0x0611, RW: "R"},
        "importReactiveEnergyL2T1": {ADDR: 0x0612, RW: "R"},
        "importReactiveEnergyL3T1": {ADDR: 0x0613, RW: "R"},
        "importReactiveEnergySystemT2": {ADDR: 0x0620, RW: "R"},
        "importReactiveEnergyL1T2": {ADDR: 0x0621, RW: "R"},
        "importReactiveEnergyL2T2": {ADDR: 0x0622, RW: "R"},
        "importReactiveEnergyL3T2": {ADDR: 0x0623, RW: "R"},
        "importReactiveEnergySystemT3": {ADDR: 0x0630, RW: "R"},
        "importReactiveEnergyL1T3": {ADDR: 0x0631, RW: "R"},
        "importReactiveEnergyL2T3": {ADDR: 0x0632, RW: "R"},
        "importReactiveEnergyL3T3": {ADDR: 0x0633, RW: "R"},
        "importReactiveEnergySystemT4": {ADDR: 0x0640, RW: "R"},
        "importReactiveEnergyL1T4": {ADDR: 0x0641, RW: "R"},
        "importReactiveEnergyL2T4": {ADDR: 0x0642, RW: "R"},
        "importReactiveEnergyL3T4": {ADDR: 0x0643, RW: "R"},
        "importReactiveEnergySystemPartial": {ADDR: 0x06A0, RW: "R"},
        "importReactiveEnergyL1Partial": {ADDR: 0x06A1, RW: "R"},
        "importReactiveEnergyL2Partial": {ADDR: 0x06A2, RW: "R"},
        "importReactiveEnergyL3Partial": {ADDR: 0x06A3, RW: "R"},
        "exportReactiveEnergySystem": {ADDR: 0x0700, RW: "R"},
        "exportReactiveEnergyL1": {ADDR: 0x0701, RW: "R"},
        "exportReactiveEnergyL2": {ADDR: 0x0702, RW: "R"},
        "exportReactiveEnergyL3": {ADDR: 0x0703, RW: "R"},
        "exportReactiveEnergySystemT1": {ADDR: 0x0710, RW: "R"},
        "exportReactiveEnergyL1T1": {ADDR: 0x0711, RW: "R"},
        "exportReactiveEnergyL2T1": {ADDR: 0x0712, RW: "R"},
        "exportReactiveEnergyL3T1": {ADDR: 0x0713, RW: "R"},
        "exportReactiveEnergySystemT2": {ADDR: 0x0720, RW: "R"},
        "exportReactiveEnergyL1T2": {ADDR: 0x0721, RW: "R"},
        "exportReactiveEnergyL2T2": {ADDR: 0x0722, RW: "R"},
        "exportReactiveEnergyL3T2": {ADDR: 0x0723, RW: "R"},
        "exportReactiveEnergySystemT3": {ADDR: 0x0730, RW: "R"},
        "exportReactiveEnergyL1T3": {ADDR: 0x0731, RW: "R"},
        "exportReactiveEnergyL2T3": {ADDR: 0x0732, RW: "R"},
        "exportReactiveEnergyL3T3": {ADDR: 0x0733, RW: "R"},
        "exportReactiveEnergySystemT4": {ADDR: 0x0740, RW: "R"},
        "exportReactiveEnergyL1T4": {ADDR: 0x0741, RW: "R"},
        "exportReactiveEnergyL2T4": {ADDR: 0x0742, RW: "R"},
        "exportReactiveEnergyL3T4": {ADDR: 0x0743, RW: "R"},
        "exportReactiveEnergySystemPartial": {ADDR: 0x07A0, RW: "R"},
        "exportReactiveEnergyL1Partial": {ADDR: 0x07A1, RW: "R"},
        "exportReactiveEnergyL2Partial": {ADDR: 0x07A2, RW: "R"},
        "exportReactiveEnergyL3Partial": {ADDR: 0x07A3, RW: "R"},
        "activeEnergyBalanceSystem": {ADDR: 0x0800, RW: "R"},
        "activeEnergyBalanceL1": {ADDR: 0x0801, RW: "R"},
        "activeEnergyBalanceL2": {ADDR: 0x0802, RW: "R"},
        "activeEnergyBalanceL3": {ADDR: 0x0803, RW: "R"},
        "reactiveEnergyBalanceSystem": {ADDR: 0x08F0, RW: "R"},
        "reactiveEnergyBalanceL1": {ADDR: 0x08F1, RW: "R"},
        "reactiveEnergyBalanceL2": {ADDR: 0x08F2, RW: "R"},
        "reactiveEnergyBalanceL3": {ADDR: 0x08F3, RW: "R"},
        "reactiveEnergyZone1System": {ADDR: 0xA100, RW: "R"},
        "reactiveEnergyZone1L1": {ADDR: 0xA101, RW: "R"},
        "reactiveEnergyZone1L2": {ADDR: 0xA102, RW: "R"},
        "reactiveEnergyZone1L3": {ADDR: 0xA103, RW: "R"},
        "reactiveEnergyZone1SystemT1": {ADDR: 0xA110, RW: "R"},
        "reactiveEnergyZone1L1T1": {ADDR: 0xA111, RW: "R"},
        "reactiveEnergyZone1L2T1": {ADDR: 0xA112, RW: "R"},
        "reactiveEnergyZone1L3T1": {ADDR: 0xA113, RW: "R"},
        "reactiveEnergyZone1SystemT2": {ADDR: 0xA120, RW: "R"},
        "reactiveEnergyZone1L1T2": {ADDR: 0xA121, RW: "R"},
        "reactiveEnergyZone1L2T2": {ADDR: 0xA122, RW: "R"},
        "reactiveEnergyZone1L3T2": {ADDR: 0xA123, RW: "R"},
        "reactiveEnergyZone2System": {ADDR: 0xA200, RW: "R"},
        "reactiveEnergyZone2L1": {ADDR: 0xA201, RW: "R"},
        "reactiveEnergyZone2L2": {ADDR: 0xA202, RW: "R"},
        "reactiveEnergyZone2L3": {ADDR: 0xA203, RW: "R"},
        "reactiveEnergyZone2SystemT1": {ADDR: 0xA210, RW: "R"},
        "reactiveEnergyZone2L1T1": {ADDR: 0xA211, RW: "R"},
        "reactiveEnergyZone2L2T1": {ADDR: 0xA212, RW: "R"},
        "reactiveEnergyZone2L3T1": {ADDR: 0xA213, RW: "R"},
        "reactiveEnergyZone2SystemT2": {ADDR: 0xA220, RW: "R"},
        "reactiveEnergyZone2L1T2": {ADDR: 0xA221, RW: "R"},
        "reactiveEnergyZone2L2T2": {ADDR: 0xA222, RW: "R"},
        "reactiveEnergyZone2L3T2": {ADDR: 0xA223, RW: "R"},
        "reactiveEnergyZone3System": {ADDR: 0xA300, RW: "R"},
        "reactiveEnergyZone3L1": {ADDR: 0xA301, RW: "R"},
        "reactiveEnergyZone3L2": {ADDR: 0xA302, RW: "R"},
        "reactiveEnergyZone3L3": {ADDR: 0xA303, RW: "R"},
        "reactiveEnergyZone3SystemT1": {ADDR: 0xA310, RW: "R"},
        "reactiveEnergyZone3L1T1": {ADDR: 0xA311, RW: "R"},
        "reactiveEnergyZone3L2T1": {ADDR: 0xA312, RW: "R"},
        "reactiveEnergyZone3L3T1": {ADDR: 0xA313, RW: "R"},
        "reactiveEnergyZone3SystemT2": {ADDR: 0xA320, RW: "R"},
        "reactiveEnergyZone3L1T2": {ADDR: 0xA321, RW: "R"},
        "reactiveEnergyZone3L2T2": {ADDR: 0xA322, RW: "R"},
        "reactiveEnergyZone3L3T2": {ADDR: 0xA323, RW: "R"},
        "reactiveEnergyZone4System": {ADDR: 0xA400, RW: "R"},
        "reactiveEnergyZone4L1": {ADDR: 0xA401, RW: "R"},
        "reactiveEnergyZone4L2": {ADDR: 0xA402, RW: "R"},
        "reactiveEnergyZone4L3": {ADDR: 0xA403, RW: "R"},
        "reactiveEnergyZone4SystemT1": {ADDR: 0xA410, RW: "R"},
        "reactiveEnergyZone4L1T1": {ADDR: 0xA411, RW: "R"},
        "reactiveEnergyZone4L2T1": {ADDR: 0xA412, RW: "R"},
        "reactiveEnergyZone4L3T1": {ADDR: 0xA413, RW: "R"},
        "reactiveEnergyZone4SystemT2": {ADDR: 0xA420, RW: "R"},
        "reactiveEnergyZone4L1T2": {ADDR: 0xA421, RW: "R"},
        "reactiveEnergyZone4L2T2": {ADDR: 0xA422, RW: "R"},
        "reactiveEnergyZone4L3T2": {ADDR: 0xA423, RW: "R"},
        "digitalInputFlags": {ADDR: 0x2100, RW: "R"},
        "digitalInput1Counter": {ADDR: 0x2110, RW: "R"},
        "digitalInput1OnTime": {ADDR: 0x2111, RW: "R"},
        "digitalInput2Counter": {ADDR: 0x2120, RW: "R"},
        "digitalInput2OnTime": {ADDR: 0x2121, RW: "R"},
        "diagnosticAlarms": {ADDR: 0xEEA0, RW: "R"},
        "diagnosticErrorFlags": {ADDR: 0xEEE0, RW: "R"},

    },
    ERRORS : {
        CMD_INVALID: "Invalid command",
        CMD_REGISTER_NOT_FOUND: "Register not found in the device registers",
        CMD_REGISTER_NOT_WRITABLE: "Register not writable",
        CMD_REGISTER_NOT_READABLE: "Register not readable",
        CMD_REGISTER_NUMBER_INVALID: "Invalid number of registers",
        CMD_DATA_INVALID: "Invalid data in the command",
        CMD_FPORT_INVALID: "Invalid fPort in the command"
    },
    WARNING_NAME   : "warning",
    ERROR_NAME     : "error",
    INFO_NAME      : "info"
};

/************************************************************************************************************/

// Encode encodes the given object into an array of bytes. (ChirpStack v3)
//  - fPort contains the LoRaWAN fPort number
//  - obj is an object, e.g. {"temperature": 22.5}
//  - variables contains the device variables e.g. {"calibration": "3.5"} (both the key / value are of type string)
// The function must return an array of bytes, e.g. [225, 230, 255, 0]
function Encode(fPort, obj, variables) {
    if(!(DEVICE.DOWNLINK.TYPE in obj)){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_INVALID + 
            ": please add " + DEVICE.DOWNLINK.TYPE + " to the command";
        return []; // error
    }
    if(obj[DEVICE.DOWNLINK.TYPE] == DEVICE.DOWNLINK.CONFIG){
        if(fPort != DEVICE.CONFIG.FPORT){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_FPORT_INVALID;
            return []; // error
        }
        return encodeDeviceConfiguration(obj[DEVICE.DOWNLINK.CONFIG]);
    }else if(obj[DEVICE.DOWNLINK.TYPE] == DEVICE.DOWNLINK.PERIODIC){
        if(fPort < DEVICE.PERIODIC.FPORT_MIN || fPort > DEVICE.PERIODIC.FPORT_MAX){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_FPORT_INVALID;
            return []; // error
        }
        return encodeUplinkConfiguration(obj[DEVICE.DOWNLINK.PERIODIC]);
    }else if(obj[DEVICE.DOWNLINK.TYPE] == DEVICE.DOWNLINK.READING){
        if(fPort != DEVICE.READING.FPORT){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_FPORT_INVALID;
            return []; // error
        }
        return encodeParameterReading(obj[DEVICE.DOWNLINK.READING]);
    }
    DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_INVALID + 
        ": please check " + obj[DEVICE.DOWNLINK.TYPE] + " in the command";
    return []; // error
}

// Encode downlink function. (ChirpStack v4 , TTN, TTI, LORIOT, ThingPark)
//
// Input is an object with the following fields:
// - data = Object representing the payload that must be encoded.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - bytes = Byte array containing the downlink payload.
function encodeDownlink(input) {
    var fPort = DEVICE.CONFIG.FPORT; // by default use config fPort (50)
    if(input.data.fPort)
    {
        fPort = input.data.fPort;
    }
    var errors = [];
    var warnings = [];
    var encoded = Encode(fPort, input.data, input.variables);
    if(DEVICE.ERROR_NAME in DEVICE)
    {
        errors.push(DEVICE[DEVICE.ERROR_NAME]);
    }
    if(DEVICE.WARNING_NAME in DEVICE)
    {
        warnings.push(DEVICE[DEVICE.WARNING_NAME]);
    }
    return {
        bytes: encoded,
        fPort: fPort,
        errors: errors,
        warnings : warnings
    };
}


/************************************************************************************************************/


function encodeDeviceConfiguration(cmdArray)
{
    var encoded = [];

    if(!(cmdArray)){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_INVALID + 
            ": please add " + DEVICE.DOWNLINK.CONFIG + " array to the command";
        return []; // error
    }
    if(cmdArray.length < DEVICE.CONFIG.REG_MIN_NUMBER ||
        cmdArray.length > DEVICE.CONFIG.REG_MAX_NUMBER){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NUMBER_INVALID + 
            ": please check " + DEVICE.DOWNLINK.CONFIG + " in the command";
        return [];
    }
    
    for(var i=0; i<cmdArray.length; i=i+1)
    {
        var cmdObj = cmdArray[i];
        if(!("Param" in cmdObj) || !("Value" in cmdObj)){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_INVALID + 
            ": please add Param and Value to each object in the " + 
            DEVICE.DOWNLINK.CONFIG + " array of the command";
            return []; // error
        }
        var regName = cmdObj.Param;
        if(!(regName in DEVICE.REGISTERS)){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NOT_FOUND + 
                ": please check " + regName + " in the command";
            return []; // error
        }
        var reg = DEVICE.REGISTERS[regName];
        if(reg.RW == "R"){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NOT_WRITABLE +
                ": please check " + regName + " in the command";
            return [];  // error
        }
        if(cmdObj.Value < reg.MIN || cmdObj.Value > reg.MAX){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_DATA_INVALID +
                ": please check " + regName + " in the command";
            return []; // error
        }
      
        // ADDR
        encoded.push((reg.ADDR >> 8) & 0xFF);
        encoded.push(reg.ADDR & 0xFF);
 
        if(reg.SIZE == 0){
            if(typeof cmdObj.Value == "string"){
                // length of the string
                encoded.push(cmdObj.Value.length);
                // string
                for(var j=0; j<cmdObj.Value.length; j=j+1){
                    encoded.push(cmdObj.Value.charCodeAt(j));
                }
            }
        } else if(reg.SIZE == 4){
            encoded.push((cmdObj.Value >> 24) & 0xFF);
            encoded.push((cmdObj.Value >> 16) & 0xFF);
            encoded.push((cmdObj.Value >> 8) & 0xFF);
            encoded.push(cmdObj.Value & 0xFF);
        }else if(reg.SIZE == 2){
            encoded.push((cmdObj.Value >> 8) & 0xFF);
            encoded.push(cmdObj.Value & 0xFF);
        }else if(reg.SIZE == 1){
            encoded.push(cmdObj.Value);
        } else {
            
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_DATA_INVALID +
                ": please check " + regName + " in the command";
            return []; // error
        }
    }
    return encoded;
}

function encodeUplinkConfiguration(cmdObj)
{
    var encoded = [];

    if(!(cmdObj)){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_INVALID + 
            ": please add " + DEVICE.DOWNLINK.PERIODIC + " object to the command";
        return []; // error
    }
    if(!("UplinkInterval" in cmdObj) ||  !("Mode" in cmdObj) ||
        !("Status" in cmdObj) || !("Registers" in cmdObj)){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_INVALID;
        return []; // error
    }
    // Encode UplinkInterval, Mode, Status
    if(cmdObj.UplinkInterval < 0 || cmdObj.UplinkInterval > 0xFFFF){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_DATA_INVALID +
        ": please check UplinkInterval in the command";
        return []; // error
    }
    encoded.push(DEVICE.PERIODIC.CHANNEL);
    encoded.push(DEVICE.PERIODIC.INTERVAL_TYPE);
    encoded.push((cmdObj.UplinkInterval >> 8) & 0xFF);
    encoded.push(cmdObj.UplinkInterval & 0xFF);

    if(cmdObj.Mode < 0 || cmdObj.Mode > 1){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_DATA_INVALID +
            ": please check Mode in the command";
        return []; // error
    }
    encoded.push(DEVICE.PERIODIC.CHANNEL);
    encoded.push(DEVICE.PERIODIC.MODE_TYPE);
    encoded.push(cmdObj.Mode);
    
    if(cmdObj.Status < 0 || cmdObj.Status > 1){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_DATA_INVALID +
            ": please check Status in the command";
        return []; // error
    }
    encoded.push(DEVICE.PERIODIC.CHANNEL);
    encoded.push(DEVICE.PERIODIC.STATUS_TYPE);
    encoded.push(cmdObj.Status);
    // Encode registers
    if(cmdObj.Registers.length < DEVICE.PERIODIC.REG_MIN_NUMBER || 
        cmdObj.Registers.length > DEVICE.PERIODIC.REG_MAX_NUMBER){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NUMBER_INVALID +
            ": please check Registers in the command";
        return [];  // Error
    }
    encoded.push(DEVICE.PERIODIC.CHANNEL);
    encoded.push(DEVICE.PERIODIC.REGISTERS_TYPE);
    // data length (2 bytes per ADDR)
    encoded.push(cmdObj.Registers.length * 2);
    for(var i=0; i<cmdObj.Registers.length; i=i+1)
    {
        var regName = cmdObj.Registers[i];
        if(!(regName in DEVICE.REGISTERS)){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NOT_FOUND + 
                ": please check " + regName + " in the command";
            return []; // error (registers not supported)
        }
        var reg = DEVICE.REGISTERS[regName];
        if(reg.RW == "W"){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NOT_READABLE +
                ": please check " + regName + " in the command";
            return [];  // error
        }
        // ADDR
        encoded.push((reg.ADDR >> 8) & 0xFF);
        encoded.push(reg.ADDR & 0xFF);
    }
    return encoded;
}

function encodeParameterReading(cmdArray)
{
    var encoded = [];

    if(!(cmdArray)){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_INVALID + 
            ": please add " + DEVICE.DOWNLINK.READING + " array to the command";
        return []; // error
    }
    if(cmdArray.length < DEVICE.READING.REG_MIN_NUMBER ||
        cmdArray.length > DEVICE.READING.REG_MAX_NUMBER){
        DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NUMBER_INVALID +
            ": please check " + DEVICE.DOWNLINK.READING + " in the command";
        return []; // error
    }
    encoded.push(DEVICE.READING.CHANNEL);
    encoded.push(DEVICE.READING.TYPE);
    for(var i=0; i<cmdArray.length; i=i+1)
    {
        var regName = cmdArray[i];
        if(!(regName in DEVICE.REGISTERS)){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NOT_FOUND +
                ": please check " + regName + " in the command";
            return []; // error
        }
        var reg = DEVICE.REGISTERS[regName];
        if(reg.RW == "W"){
            DEVICE[DEVICE.ERROR_NAME] = DEVICE.ERRORS.CMD_REGISTER_NOT_READABLE +
                ": please check " + regName + " in the command";
            return [];  // error
        }
        // ADDR
        encoded.push((reg.ADDR >> 8) & 0xFF);
        encoded.push(reg.ADDR & 0xFF);
    }
    return encoded;
}

