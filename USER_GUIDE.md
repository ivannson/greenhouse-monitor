# Greenhouse Monitor User Guide

This guide explains how to set up and operate the ESP32-C3 greenhouse monitor, including the setup portal, status LED, button behavior, and WiFi connection flow.

## What the Device Does

On a successful measurement cycle, the device:

1. Starts up and initializes the sensors, SD card, status LED, and saved WiFi settings.
2. Connects to the saved WiFi network if one is stored.
3. Reads the AHT20 and BMP280 sensors.
4. Sends the reading to ThingSpeak when WiFi is connected.
5. Appends the reading to `/data.csv` on the SD card.
6. Sleeps for 10 minutes, then wakes and repeats.

Readings are logged with these CSV columns:

```text
time (UTC), date, sent_to_cloud, temp_1, temp_2, humidity, pressure
```

`sent_to_cloud` is `1` when the ThingSpeak upload succeeded and `0` when it did not.

## Hardware Summary

| Part | Connection / behavior |
| --- | --- |
| Board | ESP32-C3-SuperMini using the Arduino framework. |
| Temperature / humidity sensor | AHT20 over I2C. |
| Temperature / pressure sensor | BMP280 over I2C at address `0x76` or `0x77`. |
| SD card | SPI, using CS GPIO 7, MOSI GPIO 6, MISO GPIO 5, SCK GPIO 4. |
| Status LED | WS2812 / NeoPixel on GPIO 3. |
| Configuration button | GPIO 21, active low with internal pull-up. |

## Status LED Meanings

The status LED is a single WS2812 / NeoPixel connected to GPIO 3.

| LED state | Meaning |
| --- | --- |
| White for about 2 seconds at power-on | Device has booted. |
| Off | Normal idle/sleep transition state, or the device is in deep sleep. |
| Green | WiFi connected, or SD data write succeeded. During the publish cycle, green is also used for a successful SD write. |
| Red | WiFi connection has failed enough times to latch the failure indicator. This failure state is remembered across deep sleep until WiFi connects successfully. |
| Red/white flashing | The device is waiting before another WiFi retry. |
| Blue | WiFi setup access point / captive portal is active. |
| Purple for about 1 second | SD data write failed. |
| Dim white briefly before sleep | Device is about to enter deep sleep. |

Because green is used for both "WiFi connected" and "data write success", use the timing to tell them apart: green during connection means WiFi success; green after sensor readings means the SD write succeeded.

## Button Functions

The configuration button is connected to GPIO 21 and uses the ESP32 internal pull-up. Pressing the button pulls the pin low.

| Action | Result |
| --- | --- |
| Hold the button while powering on or resetting | Starts the WiFi setup portal immediately. |
| Press the button while the device is awake | Starts the WiFi setup portal. This can interrupt retry waits. |
| Press the button while the device is in deep sleep | No immediate effect. Hold the button while resetting or power-cycling to force setup immediately. |

When the setup portal is started manually with the button, it stays active until the device connects to WiFi. When the setup portal is started automatically after failed WiFi retries, it stays active for 5 minutes before the device goes back to sleep.

## First-Time Setup Flow

1. Flash the firmware to the ESP32-C3-SuperMini.
2. Connect the sensors, SD card module, status LED, and configuration button.
3. Power on the device.
4. If you want setup immediately, hold the configuration button while powering on or resetting.
5. Connect your phone or computer to this WiFi network:

   ```text
   greenhouse-temperature-setup
   ```

   The setup network is open and has no password.

6. A captive portal should open automatically. If it does not, open a browser and go to:

   ```text
   http://192.168.4.1
   ```

7. Select **Scan WiFi**.
8. Choose your WiFi network from the list, or type the SSID manually.
9. Enter the WiFi password.
10. Select **Save & Connect**.

After saving, the device stores the credentials in flash memory, tries to connect, and updates the setup page status. When the connection succeeds, the setup access point closes, the device takes a reading, uploads/logs it, and enters deep sleep.

## Normal Startup With a Known Network

A "known network" means the device already has a saved SSID from a previous setup.

On startup with saved WiFi credentials:

1. The LED turns white for about 2 seconds.
2. The device initializes sensors and SD storage.
3. The device tries to connect to the saved WiFi network.
4. It can make up to 10 connection attempts.
5. Each connection attempt has a 10 second timeout.
6. Between failed attempts, the LED flashes red/white during the retry wait.
7. After the fifth failed attempt, the red WiFi failure indicator latches.
8. If WiFi connects, the LED turns green and the failure latch is cleared.
9. The device reads the sensors, syncs time with NTP, sends to ThingSpeak, writes to SD, and sleeps for 10 minutes.

The IP address shown in the setup page is intentionally masked by the firmware.

## If the Known Network Is Available

If the saved WiFi network is in range and the password is correct, the device connects automatically. No user action is needed.

After connection, it performs one measurement cycle and then sleeps for 10 minutes. During deep sleep, the device is not serving the setup page and will not respond to the button until it wakes or is reset.

## If the Known Network Is Missing or the Password Is Wrong

If saved credentials exist but the network cannot be reached, or the password no longer works:

1. The device retries WiFi up to 10 times.
2. The LED flashes red/white between retries.
3. After the fifth failed attempt, the LED turns red and the red failure state is saved.
4. After all retries fail, the device starts the setup access point:

   ```text
   greenhouse-temperature-setup
   ```

5. The LED turns blue while the setup portal is active.
6. The portal stays active for 5 minutes.
7. If new working credentials are entered, the device connects, clears the red failure state, takes a reading, and sleeps.
8. If no working credentials are entered within 5 minutes, the device goes back to sleep for 10 minutes and will try again on the next wake cycle.

## If There Are No Saved Networks

If the device has no saved SSID in flash memory, it reports that no stored WiFi credentials exist. In the current firmware, it still runs through the WiFi retry cycle before opening the setup portal automatically.

Expected behavior:

1. The LED turns white briefly at boot.
2. The device initializes hardware and SD storage.
3. WiFi connection attempts fail because no SSID is stored.
4. After the retry cycle, the setup portal starts.
5. The LED turns blue.
6. Connect to `greenhouse-temperature-setup` and enter WiFi credentials.

To avoid waiting for the automatic retry cycle on first setup, hold the configuration button while powering on or resetting the device. This starts the setup portal immediately.

## If the WiFi Scan Shows No Networks

If the setup page says no networks were found:

1. Move the device closer to the router.
2. Select **Scan WiFi** again.
3. Check that the router is broadcasting a 2.4 GHz WiFi network. ESP32-C3 devices do not connect to 5 GHz-only networks.
4. Type the SSID manually if the network is hidden.
5. Save the credentials and wait for the status page to update.

## Changing WiFi Later

To replace the saved WiFi credentials:

1. Hold the configuration button while resetting the device, or press the button while the device is awake.
2. Connect to `greenhouse-temperature-setup`.
3. Open the setup portal.
4. Enter the new SSID and password.
5. Select **Save & Connect**.

The new credentials overwrite the previous saved credentials.

## SD Card Behavior

The device initializes the SD card at startup and creates `/data.csv` if it does not already exist.

If the SD card is missing or cannot be initialized:

- The serial monitor prints an SD initialization error.
- The device can still connect to WiFi and try to upload to ThingSpeak.
- The LED turns purple when the data write fails.

## Serial Monitor

For troubleshooting, use the PlatformIO serial monitor at 115200 baud:

```bash
pio device monitor
```

Useful serial messages include:

- `No stored WiFi credentials`
- `WiFi connection attempt X of 10`
- `WiFi connected`
- `WiFi connection failed after retries`
- `Captive portal active`
- `Time synchronized via NTP`
- `SD card initialized`
- `Failed to open data.csv for append`
- `Entering deep sleep for 600 seconds`

## Developer Commands

Build the firmware:

```bash
pio run
```

Upload the firmware:

```bash
pio run --target upload
```

Open the serial monitor:

```bash
pio device monitor
```
