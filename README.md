# Greenhouse Monitor

A PlatformIO project for monitoring greenhouse environmental conditions using ESP32-C3-SuperMini.

For non-technical operating instructions, see [END_USER_GUIDE.md](END_USER_GUIDE.md).

For the Russian non-technical user guide, see [END_USER_GUIDE_RU.md](END_USER_GUIDE_RU.md).

For technical operating details, setup flow, LED meanings, button behavior, and WiFi troubleshooting, see [USER_GUIDE.md](USER_GUIDE.md).

For the mobile web dashboard (Vite + React, deployed on Vercel), see [dashboard/README.md](dashboard/README.md).

## Hardware

- **Board**: ESP32-C3-SuperMini
- **Framework**: Arduino
- **Sensors**: AHT20 temperature/humidity, BMP280 temperature/pressure
- **Storage**: SD card over SPI
- **Status**: WS2812 / NeoPixel status LED
- **Setup input**: Configuration button for WiFi setup mode

## Project Structure

```
greenhouse-monitor/
├── platformio.ini    # PlatformIO configuration
├── src/              # Source code
│   └── main.cpp      # Main application code
├── include/          # Header files
├── lib/              # Custom libraries
├── test/             # Unit tests
└── README.md
```

## Setup

1. Install PlatformIO (if not already installed):
   - VS Code: Install PlatformIO IDE extension
   - CLI: `pip install platformio`

2. Open the project in PlatformIO

3. Connect your ESP32-C3-SuperMini via USB

4. Build and upload:
   ```bash
   pio run --target upload
   ```

5. Monitor serial output:
   ```bash
   pio device monitor
   ```

## Configuration

Edit `platformio.ini` to:
- Add sensor libraries to `lib_deps`
- Adjust pin definitions in `src/main.cpp`
- Modify sensor calibration formulas based on your hardware

## Pin Connections

Pin definitions are in `src/main.cpp`:

- Status LED: GPIO 3
- Configuration button: GPIO 21, active low
- SD card CS: GPIO 7
- SD card MOSI: GPIO 6
- SD card MISO: GPIO 5
- SD card SCK: GPIO 4
- AHT20 and BMP280: I2C using the board defaults

## Development

- Build: `pio run`
- Upload: `pio run --target upload`
- Monitor: `pio device monitor`
- Clean: `pio run --target clean`
