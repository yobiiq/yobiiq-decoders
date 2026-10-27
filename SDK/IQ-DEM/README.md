# DEM electricity meter (DEM1, DEM2, DEM4) - YOBIIQ B.V.

Codec for the DEM electricity meters with LoRaWAN, models DEM1, DEM2 and DEM4 (product code 26000x). One codec covers the three models.

## Files

File | Content
---|---
[IQ-DEM.js](IQ-DEM.js) | Codec, version 1.2.0
[IQ-DEM.txt](IQ-DEM.txt) | Downlink examples
[IQ-DEM.examples.json](IQ-DEM.examples.json) | Payload examples: uplinks with their decoded output, downlinks with their bytes
`firmware/` | Signed firmware images for over-the-air updates

## Codec

- Version **1.2.0**, written for the DEM firmware **v1.2.0**. The codec version follows the firmware version.
- Entry points: `decodeUplink` and `encodeDownlink` (LoRa Alliance TS013-1.0.0) for The Things Stack, ChirpStack v4, LORIOT, ThingPark; `Decode` and `Encode` for ChirpStack v3.
- Written in ES3 syntax without ES5+ library calls, so it runs on every network server engine, including the ChirpStack v3 one.
- Every decoded uplink also carries the codec information: `codecVersion`, `genericModel`, `manufacturer` (and `productCode` where the product has one).

The registers, their ranges, defaults and downlink commands are described in the Technical Reference Manual: [DEM1](https://yobiiq.com/documentation/technical-guides/dem1-technical-reference-manual), [DEM2](https://yobiiq.com/documentation/technical-guides/dem2-technical-reference-manual), [DEM4](https://yobiiq.com/documentation/technical-guides/dem4-technical-reference-manual).

### Uplinks

fPort | Content
---|---
0 | MAC commands (reported as such, no data)
1-10 | Periodic uplinks: timestamp and the configured registers
11 | Alarms
20 | Max demand records
50 | Device information sent after each join, answers to configuration commands
100 | Answers to register reads
200-202 | FUOTA session packages (reported as such, no data)
203 | Firmware Management Protocol answers (firmware version, image status)

A one byte answer (`00` or `01`) on the fPort of a downlink reports that the command succeeded or failed.

### Downlinks

fPort | `Type` | Content
---|---|---
50 | `Config` | Register writes (configuration and commands)
100 | `Reading` | Register reads, answered on fPort 100
11 | `MaxDemand` | Max demand logging configuration

[IQ-DEM.txt](IQ-DEM.txt) lists ready to use commands: the JSON object to pass to the encoder, with notes on the parameters.

[IQ-DEM.examples.json](IQ-DEM.examples.json) lists payload examples checked against the codec: each uplink (`payload`, also as `payloadHex` without spaces, ready to paste) with its decoded output, and each downlink command with the bytes it encodes to.

## Firmware OTA package

The firmware is built once per variant: every released version has one signed image per variant, all in the folder of that version.

Variant | Devices | Image
---|---|---
DEM1 | DEM1 meters | `IQ-DEM1_v<x.y.z>.bin`
DEM2 | DEM2 meters | `IQ-DEM2_v<x.y.z>.bin`
DEM4 | DEM4 meters | `IQ-DEM4_v<x.y.z>.bin`

```
firmware/
  v<x.y.z>/
    IQ-DEM1_v<x.y.z>.bin   signed firmware image for LoRaWAN FUOTA
    IQ-DEM2_v<x.y.z>.bin   signed firmware image for LoRaWAN FUOTA
    IQ-DEM4_v<x.y.z>.bin   signed firmware image for LoRaWAN FUOTA
    SHA256SUMS             SHA-256 checksums of the images
    CHANGELOG.md           changes of this version
```

- Send the signed `.bin` image to the devices with the LoRa Alliance FUOTA packages, see [FUOTA deployment with ChirpStack](https://yobiiq.com/documentation/technical-guides/fuota-deployment-chirpstack). The device checks the signature of the image before it installs it.
- Send each device the image of its own variant only. All variants are signed with the same key, so the signature check does not tell them apart: group the devices of one variant in their own multicast session.
- Check the images before sending them: `sha256sum -c SHA256SUMS` in the version folder.
- Use the codec of the same version as the firmware: after an update, update the codec in the network server too. One codec decodes every variant.

Firmware | Codec | DEM1 | DEM2 | DEM4 | Changes
---|---|---|---|---|---
v1.2.0 | 1.2.0 | [IQ-DEM1_v1.2.0.bin](firmware/v1.2.0/IQ-DEM1_v1.2.0.bin) | [IQ-DEM2_v1.2.0.bin](firmware/v1.2.0/IQ-DEM2_v1.2.0.bin) | [IQ-DEM4_v1.2.0.bin](firmware/v1.2.0/IQ-DEM4_v1.2.0.bin) | [CHANGELOG.md](firmware/v1.2.0/CHANGELOG.md)
