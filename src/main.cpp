#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP280.h>

// Sensor objects
Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp; // I2C

void setup() {
    Serial.begin(115200);
    delay(200);
    
    Wire.begin(); // uses default SDA/SCL for the board
    
    Serial.println("=== AHT20 + BMP280 I2C Test ===");
    
    // --- AHT20 ---
    if (!aht.begin()) {
        Serial.println("AHT20 not found");
    } else {
        Serial.println("AHT20 OK");
    }
    
    // --- BMP280 ---
    if (!bmp.begin(0x76)) { // try 0x76 first
        if (!bmp.begin(0x77)) {
            Serial.println("BMP280 not found");
        } else {
            Serial.println("BMP280 OK at 0x77");
        }
    } else {
        Serial.println("BMP280 OK at 0x76");
    }
    
    bmp.setSampling(
        Adafruit_BMP280::MODE_NORMAL,
        Adafruit_BMP280::SAMPLING_X2,   // temp
        Adafruit_BMP280::SAMPLING_X16,  // pressure
        Adafruit_BMP280::FILTER_X16,
        Adafruit_BMP280::STANDBY_MS_500
    );
    
    Serial.println("\nStarting sensor readings...\n");
}

void loop() {
    sensors_event_t humidity, temp;
    aht.getEvent(&humidity, &temp);
    
    Serial.print("AHT20  Temp: ");
    Serial.print(temp.temperature);
    Serial.print(" °C  Humidity: ");
    Serial.print(humidity.relative_humidity);
    Serial.println(" %");
    
    Serial.print("BMP280 Temp: ");
    Serial.print(bmp.readTemperature());
    Serial.print(" °C  Pressure: ");
    Serial.print(bmp.readPressure() / 100.0);
    Serial.println(" hPa");
    
    Serial.println("-----------------------------");
    
    delay(5000); // Read every 5 seconds
}
