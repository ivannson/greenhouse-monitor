# Greenhouse Monitor

A PlatformIO project for monitoring greenhouse environmental conditions using ESP32-C3-SuperMini.

## Hardware

- **Board**: ESP32-C3-SuperMini
- **Framework**: Arduino
- **Sensors**: Temperature, Humidity, Light Level

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

Update pin definitions in `src/main.cpp` based on your sensor connections:
- Temperature sensor: Currently set to A0
- Humidity sensor: Currently set to A1
- Light sensor: Currently set to A2

## Development

- Build: `pio run`
- Upload: `pio run --target upload`
- Monitor: `pio device monitor`
- Clean: `pio run --target clean`

