# Payload codecs and firmware for YOBIIQ devices

This repository contains the JavaScript payload codecs (decoders and encoders) that integrate YOBIIQ
LoRaWAN&reg; devices into a network server, and the firmware images used to update the current
generation of devices over the air.

The codecs follow the LoRa Alliance Payload Codec API (TS013-1.0.0, `decodeUplink` and
`encodeDownlink`) and also export the ChirpStack v3 `Decode` and `Encode` functions. They run on
The Things Stack (TTN, TTI), ChirpStack v3 and v4, LORIOT, ThingPark and any network server that
follows the LoRa Alliance API.

Pull requests fixing issues, improving the quality or supporting new platforms are welcome.

## Repository structure

```
SDK/                     current generation devices: one folder per product
  IQ-<NAME>/
    IQ-<NAME>.js         codec for the current firmware
    IQ-<NAME>.txt        downlink examples
    README.md            codec and firmware description
    firmware/v<x.y.z>/   signed firmware images for over-the-air updates
IQ-<NAME>/               previous generation devices: codec and downlink examples
```

The `Codec_*` codecs of older YOBIIQ devices (EM2101, EM4301, EM4302, ESD, P1, SC-10-232, UGM)
and of devices from other manufacturers are no longer maintained on this branch: they are on the
[legacy](https://github.com/yobiiq/yobiiq-decoders/tree/legacy) branch.

## Current generation devices (SDK)

Device | Models | Codec folder | Technical Reference Manual
---|---|---|---
DEM electricity meter | DEM1, DEM2, DEM4 | [SDK/IQ-DEM](SDK/IQ-DEM) | [DEM1](https://yobiiq.com/documentation/technical-guides/dem1-technical-reference-manual), [DEM2](https://yobiiq.com/documentation/technical-guides/dem2-technical-reference-manual), [DEM4](https://yobiiq.com/documentation/technical-guides/dem4-technical-reference-manual)
PEM smart 3-phase electricity meter | PEM431 | [SDK/IQ-PEM](SDK/IQ-PEM) | [PEM431](https://yobiiq.com/documentation/technical-guides/pem431-technical-reference-manual)
RCM relay controller | RCM series | [SDK/IQ-RCM](SDK/IQ-RCM) | [RCM](https://yobiiq.com/documentation/technical-guides/rcm-technical-reference-manual)
CMD analog input module (4 inputs, 0-10 V or 4-20 mA) | CMD series (CMD-L-0D-4I) | [SDK/IQ-AIM](SDK/IQ-AIM) | [CMD](https://yobiiq.com/documentation/technical-guides/cmd-technical-reference-manual)
DSMR P1 port smart meter reader | DSMR 4/5 (NL), Smarty (LUX), DSMR 2.2/3.0 (NL legacy) | [SDK/IQ-DSMR](SDK/IQ-DSMR) | -
UWM ultrasonic water meter, UGM gas meter | UWM series, UGM series | [SDK/IQ-UGWM](SDK/IQ-UGWM) | [UWM](https://yobiiq.com/documentation/technical-guides/uwm-technical-reference-manual), [UGM](https://yobiiq.com/documentation/technical-guides/ugm-technical-reference-manual)
Any current generation device (generic registers only) | all of the above | [SDK/IQ-GENERIC](SDK/IQ-GENERIC) | [LoRaWAN stack guide](https://yobiiq.com/documentation/technical-guides/iq-lorawan-stack)

Use the product codec when it exists. IQ-GENERIC only decodes the registers that every current
generation device shares (range 0xFF00-0xFFFF: device information, LoRaWAN settings, alarms) and is
meant for a device that has no codec of its own yet.

The codec version is the firmware version it was written for: codec `1.2.0` of IQ-DEM decodes the
DEM firmware `v1.2.0`. Each folder README lists the versions.

## Previous generation devices

Device | Name | Codec folder
---|---|---
SD-1001 | [230V Mains Power Smoke Detector with LoRaWAN&reg;](https://yobiiq.com/products/smoke-detector/) | [IQ-SD1001](IQ-SD1001)
OTM | [OTM - iQ Opentherm Boiler Controller](https://yobiiq.com/products/opentherm-controller/) | [IQ-OPENTHERM-LRW](IQ-OPENTHERM-LRW)
RM200 | [RM200 - iQ Digital Relay Controller](https://yobiiq.com/products/rm200/) | [IQ-RM200-LRW](IQ-RM200-LRW)
DSMR, DSMR BASIC | [DSMR - iQ Dutch Smart Meter Reader](https://yobiiq.com/products/dsmr-smart-metering/) | [IQ-DSMR-LRW](IQ-DSMR-LRW)
EM2101 | LoRaWAN 1-phase electricity meter with built-in relay | [IQ-EM2101](IQ-EM2101)

## Usage

1. Open the codec file of your device and copy its whole content.
2. Paste it as the payload codec (payload formatter) of the device profile or end device in your
   network server.
3. Downlinks: each folder has a `<NAME>.txt` file with example commands. Pass the JSON object of an
   example to the encoder of the network server, or send the hexadecimal bytes it gives on the
   fPort it names.

## Firmware updates over the air

Current generation devices are updated with the signed firmware image (`.bin`) stored in
`SDK/IQ-<NAME>/firmware/v<x.y.z>/`, sent with the LoRa Alliance FUOTA packages. The procedure for
ChirpStack is described in the
[FUOTA deployment with ChirpStack](https://yobiiq.com/documentation/technical-guides/fuota-deployment-chirpstack)
guide. Check the image against the `SHA256SUMS` file of its folder before sending it.
