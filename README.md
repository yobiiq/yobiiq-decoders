# Payload decoders: legacy branch

This branch keeps the `Codec_*` codecs as they were when they left the `main` branch: codecs of
older YOBIIQ devices and codecs of devices from other manufacturers. They are kept for reference
and are no longer maintained.

The codecs of the current and previous generation YOBIIQ devices are on the
[main](https://github.com/yobiiq/yobiiq-decoders/tree/main) branch.

## Older YOBIIQ devices

Folder | Device | Product code
---|---|---
[Codec_EM2101](Codec_EM2101) | EM2101 electricity meter | P1002009
[Codec_EM4301](Codec_EM4301) | EM4301 electricity meter (also Datacake and Thinger.io decoders) | P1002011
[Codec_EM4302](Codec_EM4302) | EM4302 electricity meter | -
[Codec_ESD](Codec_ESD) | ESD and ISD devices | -
[Codec_P1](Codec_P1) | P1 iQ DSMR smart meter reader | -
[Codec_SC-10-232](Codec_SC-10-232) | SC-10-232 serial converter | P1002016
[Codec_UGM](Codec_UGM) | UGM gas meter (previous generation) | P003901

## Devices of other manufacturers

Folder | Device
---|---
[Codec_Adeunis](Codec_Adeunis) | Adeunis Modbus and Pulse devices
[Codec_Axioma](Codec_Axioma) | Axioma heat meters and water meters
[Codec_CMi4140](Codec_CMi4140) | CMi4140 M-Bus to LoRaWAN module
[Codec_FM432g](Codec_FM432g) | FM432g device
[Codec_UMR](Codec_UMR) | UMR device
[X_Elsys](X_Elsys) | Elsys ERS-Lite decoder for Milesight gateways

The `IQ-*` folders on this branch are copies of the YOBIIQ codecs at the time of the split; use the
versions on `main`.
