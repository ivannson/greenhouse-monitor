#include <Arduino.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP280.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>
#include <esp_sleep.h>
#include <esp_wifi.h>
#include <esp_bt.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_NeoPixel.h>
#include "time.h"

// ============================================================
// DEEP SLEEP CONFIGURATION
// ============================================================
// How long the ESP32 sleeps between sensor readings (in seconds)
const uint32_t DEEP_SLEEP_SECONDS = 600; // 10 minutes
// Convert to microseconds for esp_sleep API
const uint64_t DEEP_SLEEP_US = (uint64_t)DEEP_SLEEP_SECONDS * 1000000ULL;
// WiFi retry configuration
const uint8_t WIFI_MAX_ATTEMPTS = 10;
const unsigned long WIFI_RETRY_DELAY_MS = 10000;
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 10000;
const unsigned long CAPTIVE_PORTAL_TIMEOUT_MS = 5UL * 60UL * 1000UL; // 5 minutes
// SD card SPI pins (ESP32-C3 SuperMini)
const int SD_CS_PIN = 7;
const int SD_MOSI_PIN = 6;
const int SD_MISO_PIN = 5;
const int SD_SCK_PIN = 4;
const char *DATA_FILE = "/data.csv";
// Status LED (WS2812 / NeoPixel)
const uint8_t STATUS_LED_PIN = 3;
const uint8_t STATUS_LED_COUNT = 1;
const uint8_t STATUS_LED_BRIGHTNESS = 32;
const uint8_t STATUS_LED_SLEEP_BRIGHTNESS = 8;
const uint8_t WIFI_RED_THRESHOLD = 5;
const char *PREF_FAIL_LATCH = "failLatch";
// ============================================================

// Sensor objects
Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp; // I2C
Adafruit_NeoPixel statusPixel(STATUS_LED_COUNT, STATUS_LED_PIN, NEO_GRB + NEO_KHZ800);

Preferences prefs;
WebServer server(80);
DNSServer dnsServer;
bool portalActive = false;
bool connectRequested = false;
bool portalFromFailure = false;
unsigned long portalStartMs = 0;
const int configButtonPin = 21; // GPIO to force portal
const unsigned long buttonDebounceMs = 50;
bool buttonLastState = HIGH;
unsigned long buttonLastChangeMs = 0;
String lastStatusMessage = "Idle";
const String maskedIpPlaceholder = "xxx.xxx.xx.xxx";
bool sdReady = false;
bool timeSynced = false;
bool wifiFailureLatched = false;

// Forward declarations
void startCaptivePortal(bool fromFailure = false);
void checkConfigButtonPress();

// ThingSpeak settings
const char *thingspeakApiKey = "YOUR_THINGSPEAK_WRITE_API_KEY";
const char *thingspeakEndpoint = "http://api.thingspeak.com/update";

// Captive portal / AP settings
const char *apSsid = "greenhouse-temperature-setup";
const char *apPassword = "";

String maskIp(const IPAddress &ip) {
    (void)ip;
    return maskedIpPlaceholder;
}

void statusLedOff() {
    statusPixel.clear();
    statusPixel.show();
}

void setStatusLedColor(uint8_t r, uint8_t g, uint8_t b) {
    statusPixel.setPixelColor(0, statusPixel.Color(r, g, b));
    statusPixel.show();
}

void indicateWifiDisconnected() {
    setStatusLedColor(255, 0, 0);
}

void indicateApMode() {
    setStatusLedColor(0, 0, 255);
}

void indicateWifiConnected() {
    setStatusLedColor(0, 255, 0);
}

void initStatusLed() {
    statusPixel.begin();
    statusPixel.setBrightness(STATUS_LED_BRIGHTNESS);
    statusLedOff();
}

void serviceBackground() {
    checkConfigButtonPress();
    if (portalActive) {
        dnsServer.processNextRequest();
        server.handleClient();
    }
}

void waitWithBackground(unsigned long waitMs, bool flashRetry = false, unsigned long blinkPeriodMs = 500) {
    unsigned long start = millis();
    unsigned long lastBlink = millis();
    bool blinkState = false; // false = red, true = white
    bool firstBlink = true;
    unsigned long halfPeriod = blinkPeriodMs / 2;

    while (millis() - start < waitMs) {
        serviceBackground();
        if (portalActive) {
            break; // user requested portal; abort wait work (e.g., retries)
        }

        if (flashRetry) {
            unsigned long now = millis();
            if (firstBlink || (now - lastBlink) >= halfPeriod) {
                firstBlink = false;
                lastBlink = now;
                blinkState = !blinkState;
                if (blinkState) {
                    setStatusLedColor(255, 255, 255); // white
                } else {
                    setStatusLedColor(255, 0, 0); // red
                }
            }
        }

        delay(1); // yield to WiFi/RTOS while still responsive to button
    }
}

void indicatePowerOnWhite(unsigned long durationMs = 2000) {
    setStatusLedColor(255, 255, 255);
    waitWithBackground(durationMs);
    statusLedOff();
}

void indicateDataWrite(bool success) {
    if (success) {
        setStatusLedColor(0, 255, 0); // green for success
    } else {
        setStatusLedColor(128, 0, 128); // purple for failure
    }
    waitWithBackground(1000);
    statusLedOff();
}

void setWifiFailureLatched(bool latched) {
    if (wifiFailureLatched == latched) {
        return;
    }
    wifiFailureLatched = latched;
    prefs.putBool(PREF_FAIL_LATCH, wifiFailureLatched);
    if (wifiFailureLatched) {
        indicateWifiDisconnected();
    }
}

bool initSdCard() {
    if (sdReady) {
        return true;
    }

    SPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);

    if (!SD.begin(SD_CS_PIN)) {
        Serial.println("SD card initialization failed");
        return false;
    }

    sdReady = true;
    Serial.println("SD card initialized");
    return true;
}

bool ensureDataFileExists() {
    if (!sdReady && !initSdCard()) {
        return false;
    }

    if (SD.exists(DATA_FILE)) {
        return true;
    }

    File file = SD.open(DATA_FILE, FILE_WRITE);
    if (!file) {
        Serial.println("Failed to create data.csv");
        return false;
    }

    file.println("time (UTC), date, sent_to_cloud, temp_1, temp_2, humidity, pressure");
    file.close();
    Serial.println("Created data.csv with header");
    return true;
}

bool syncTimeFromNtp() {
    if (timeSynced) {
        return true;
    }

    configTime(0, 0, "pool.ntp.org", "time.nist.gov");

    unsigned long start = millis();
    struct tm timeinfo;
    while ((millis() - start) < 8000) {
        if (getLocalTime(&timeinfo, 500)) {
            timeSynced = true;
            Serial.println("Time synchronized via NTP");
            return true;
        }
        delay(200);
    }

    Serial.println("Failed to synchronize time");
    return false;
}

bool getUtcStrings(String &timeStr, String &dateStr) {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo, 1000)) {
        return false;
    }

    char buffer[16];
    strftime(buffer, sizeof(buffer), "%H:%M:%S", &timeinfo);
    timeStr = buffer;

    strftime(buffer, sizeof(buffer), "%Y-%m-%d", &timeinfo);
    dateStr = buffer;
    return true;
}

bool logReadingToSd(float temp1, float temp2, float humidity, float pressure, bool sentToCloud) {
    if (!ensureDataFileExists()) {
        return false;
    }

    String timeStr, dateStr;
    if (!getUtcStrings(timeStr, dateStr)) {
        timeStr = "00:00:00";
        dateStr = "1970-01-01";
    }

    File file = SD.open(DATA_FILE, FILE_APPEND);
    if (!file) {
        Serial.println("Failed to open data.csv for append");
        return false;
    }

    String row = timeStr + ", " + dateStr + ", " + String(sentToCloud ? 1 : 0) + ", " +
                 String(temp1, 2) + ", " + String(temp2, 2) + ", " + String(humidity, 2) + ", " +
                 String(pressure, 2);
    size_t written = file.println(row);
    file.close();
    return written > 0;
}

bool readStoredCredentials(String &ssid, String &password) {
    ssid = prefs.getString("ssid", "");
    password = prefs.getString("password", "");
    return ssid.length() > 0;
}

void logStatus(const String &msg) {
    lastStatusMessage = msg;
    Serial.println(msg);
}

bool connectWithStoredCredentials(bool keepAP = false, unsigned long connectTimeoutMs = WIFI_CONNECT_TIMEOUT_MS) {
    String ssid, password;
    if (!readStoredCredentials(ssid, password)) {
        logStatus("No stored WiFi credentials");
        return false;
    }

    logStatus("Connecting to WiFi SSID: " + ssid);

    WiFi.mode(keepAP ? WIFI_AP_STA : WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());

    unsigned long start = millis();
    unsigned long lastDot = 0;
    while (WiFi.status() != WL_CONNECTED &&
           (millis() - start) < connectTimeoutMs &&
           !(portalActive && !keepAP)) {
        serviceBackground();
        if (millis() - lastDot > 500) {
            Serial.print(".");
            lastDot = millis();
        }
        delay(1); // allow WiFi stack to progress
    }
    Serial.println();

    if (portalActive && !keepAP) {
        logStatus("Connection attempt aborted due to captive portal");
        return false;
    }

    if (WiFi.status() == WL_CONNECTED) {
        logStatus("WiFi connected. IP: " + maskIp(WiFi.localIP()));
        indicateWifiConnected();
        if (wifiFailureLatched) {
            setWifiFailureLatched(false);
        }
        return true;
    }

    logStatus("WiFi connection failed.");
    return false;
}

bool connectWithRetries(uint8_t maxAttempts, unsigned long retryDelayMs, bool keepAP = false) {
    for (uint8_t attempt = 1; attempt <= maxAttempts; attempt++) {
        if (portalActive) {
            logStatus("Aborting WiFi retries because captive portal is active");
            return false;
        }
        logStatus("WiFi connection attempt " + String(attempt) + " of " + String(maxAttempts));
        if (connectWithStoredCredentials(keepAP)) {
            return true;
        }

        if (attempt >= WIFI_RED_THRESHOLD && !keepAP) {
            setWifiFailureLatched(true);
        }

        if (attempt < maxAttempts) {
            logStatus("Retrying WiFi in " + String(retryDelayMs / 1000) + " seconds...");
            waitWithBackground(retryDelayMs, true);
        }
    }

    logStatus("WiFi connection failed after retries.");
    return false;
}

void checkConfigButtonPress() {
    bool currentState = digitalRead(configButtonPin);

    if (currentState != buttonLastState && (millis() - buttonLastChangeMs) > buttonDebounceMs) {
        buttonLastChangeMs = millis();
        buttonLastState = currentState;

        if (currentState == LOW) {
            logStatus("Config button pressed - starting captive portal");
            startCaptivePortal();
        }
    }
}

String getConfigPage() {
    String page = "<!DOCTYPE html><html><head>";
    page += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
    page += "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">";
    page += "<title>Greenhouse Monitor - WiFi Setup</title>";
    page += "<style>";
    page += "body{font-family:Arial,sans-serif;max-width:400px;margin:50px auto;padding:20px;background:#f5f5f5;}";
    page += ".container{background:white;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}";
    page += "h1{color:#333;text-align:center;margin-bottom:20px;}";
    page += "input{width:100%;padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:5px;box-sizing:border-box;font-size:14px;}";
    page += "select{width:100%;padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:5px;box-sizing:border-box;font-size:14px;background:white;}";
    page += ".row{display:flex;gap:10px;align-items:center;}";
    page += ".row button{width:120px;margin:0;}";
    page += ".hint{font-size:12px;color:#555;margin-top:-5px;}";
    page += "button{width:100%;padding:12px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;font-size:16px;margin-top:10px;}";
    page += "button:hover{background:#45a049;}";
    page += ".info{background:#e3f2fd;padding:15px;border-radius:5px;margin-bottom:20px;color:#1976d2;}";
    page += "</style></head><body>";
    page += "<div class=\"container\">";
    page += "<h1>📶 WiFi Configuration</h1>";
    page += "<div class=\"info\">Select your WiFi network and enter the password 🦖</div>";
    page += "<form action=\"/save\" method=\"POST\">";
    page += "<div class=\"row\"><button type=\"button\" id=\"scanBtn\">Scan WiFi</button>";
    page += "<div style=\"flex:1\"><select id=\"networks\"><option>Scan to list networks</option></select>";
    page += "<div class=\"hint\">Pick a network to auto-fill the SSID</div></div></div>";
    page += "<input id=\"ssid\" type=\"text\" name=\"ssid\" placeholder=\"WiFi Network Name (SSID)\" required autofocus>";
    page += "<input id=\"password\" type=\"password\" name=\"password\" placeholder=\"WiFi Password\" required>";
    page += "<button type=\"submit\">Save & Connect</button>";
    page += "</form>";
    page += "<div class=\"info\" id=\"statusBox\">Waiting...</div>";
    page += "<pre id=\"serialBox\" style=\"background:#111;color:#0f0;padding:10px;border-radius:6px;min-height:60px;\">Idle</pre>";
    page += "<script>";
    page += "const scanBtn=document.getElementById('scanBtn');";
    page += "const select=document.getElementById('networks');";
    page += "const ssidInput=document.getElementById('ssid');";
    page += "const statusBox=document.getElementById('statusBox');";
    page += "const serialBox=document.getElementById('serialBox');";
    page += "function populate(list){";
    page += "select.innerHTML='';";
    page += "if(!list.length){select.innerHTML='<option>No networks found</option>';return;}";
    page += "list.forEach(n=>{const opt=document.createElement('option');";
    page += "opt.value=n.ssid;opt.textContent=`${n.ssid} (${n.rssi}dBm) ${n.secure?'🔒':''}`;";
    page += "select.appendChild(opt);});";
    page += "ssidInput.value=select.options[0].value;}";
    page += "async function scan(){scanBtn.disabled=true;scanBtn.textContent='Scanning...';";
    page += "try{const r=await fetch('/scan');const data=await r.json();populate(data);}catch(e){select.innerHTML='<option>Scan failed</option>';}";
    page += "scanBtn.disabled=false;scanBtn.textContent='Scan WiFi';}";
    page += "scanBtn.addEventListener('click',scan);";
    page += "select.addEventListener('change',()=>{ssidInput.value=select.value;});";
    page += "async function pullStatus(){";
    page += "try{const r=await fetch('/status');const d=await r.json();";
    page += "statusBox.textContent=d.connected?'Connected to WiFi (IP: '+(d.ip||'" + maskedIpPlaceholder + "')+')':'Connecting...';";
    page += "serialBox.textContent=d.message||'';";
    page += "}catch(e){serialBox.textContent='Status unavailable';}";
    page += "setTimeout(pullStatus,1000);}";
    page += "window.addEventListener('load',()=>{scan();pullStatus();});";
    page += "</script>";
    page += "</div></body></html>";
    return page;
}

void sendCaptivePortalPage() {
    server.sendHeader("Cache-Control", "no-store");
    server.send(200, "text/html", getConfigPage());
}

void handleRoot() {
    Serial.println("Root page requested");
    sendCaptivePortalPage();
}

void handleSave() {
    logStatus("Save request received");
    if (!server.hasArg("ssid") || !server.hasArg("password")) {
        server.send(400, "text/plain", "Missing SSID or password");
        return;
    }

    String ssid = server.arg("ssid");
    String password = server.arg("password");

    prefs.putString("ssid", ssid);
    prefs.putString("password", password);

    logStatus("WiFi credentials saved, attempting connection...");

    String response = "<!DOCTYPE html><html><head>";
    response += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    response += "<style>body{font-family:Arial;text-align:center;padding:40px;background:#f5f5f5;}";
    response += ".card{background:#fff;padding:30px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);max-width:420px;margin:0 auto;}";
    response += ".spinner{border:4px solid #f3f3f3;border-top:4px solid #4CAF50;border-radius:50%;width:30px;height:30px;animation:spin 1s linear infinite;margin:0 auto 10px;}";
    response += "@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}";
    response += "</style></head><body><div class='card'>";
    response += "<div class='spinner' id='spin'></div>";
    response += "<h3>Connecting to WiFi...</h3>";
    response += "<p id='state'>Saving credentials and connecting. Please wait.</p>";
    response += "<p style='font-size:12px;color:#555'>This page will update once connected.</p>";
    response += "<pre id='serialBox' style='text-align:left;background:#111;color:#0f0;padding:10px;border-radius:6px;min-height:60px;'>Pending...</pre>";
    response += "</div>";
    response += "<script>";
    response += "async function check(){";
    response += "try{const r=await fetch('/status');const d=await r.json();";
    response += "document.getElementById('serialBox').textContent=d.message||'';";
    response += "if(d.connected){document.getElementById('state').textContent='✅ Connected to WiFi (IP: '+(d.ip||'" + maskedIpPlaceholder + "')+')';";
    response += "const s=document.getElementById('spin'); if(s){s.style.display='none';} return;}";
    response += "}catch(e){document.getElementById('serialBox').textContent='Status unavailable';}";
    response += "setTimeout(check,1000);}check();";
    response += "</script></body></html>";
    server.send(200, "text/html", response);

    connectRequested = true;
}

void handleNotFound() {
    Serial.print("Redirecting unknown path to captive portal: ");
    Serial.println(server.uri());
    server.sendHeader("Location", "/", true);
    server.send(302, "text/plain", "");
}

void handleScan() {
    logStatus("WiFi scan requested");
    int n = WiFi.scanNetworks(false, true);
    String *ssids = new String[n];
    int *rssis = new int[n];
    bool *secures = new bool[n];
    int uniqueCount = 0;

    for (int i = 0; i < n; i++) {
        String ssid = WiFi.SSID(i);
        int rssi = WiFi.RSSI(i);
        bool secure = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;

        int existing = -1;
        for (int j = 0; j < uniqueCount; j++) {
            if (ssids[j] == ssid) {
                existing = j;
                break;
            }
        }

        if (existing >= 0) {
            if (rssi > rssis[existing]) {
                rssis[existing] = rssi;
                secures[existing] = secure;
            }
        } else {
            ssids[uniqueCount] = ssid;
            rssis[uniqueCount] = rssi;
            secures[uniqueCount] = secure;
            uniqueCount++;
        }
    }

    String json = "[";
    for (int i = 0; i < uniqueCount; i++) {
        if (i > 0) json += ",";
        json += "{\"ssid\":\"" + ssids[i] + "\",\"rssi\":" + String(rssis[i]) + ",\"secure\":";
        json += secures[i] ? "true" : "false";
        json += "}";
    }
    json += "]";

    server.sendHeader("Cache-Control", "no-store");
    server.send(200, "application/json", json);
    WiFi.scanDelete();

    delete[] ssids;
    delete[] rssis;
    delete[] secures;
}

void startCaptivePortal(bool fromFailure) {
    if (portalActive) {
        logStatus("Captive portal already running");
        return;
    }

    portalFromFailure = fromFailure;
    portalStartMs = millis();

    logStatus("Starting access point for WiFi setup...");

    WiFi.disconnect(true);
    waitWithBackground(100);

    WiFi.mode(WIFI_AP_STA);
    waitWithBackground(100);
    WiFi.softAP(apSsid, apPassword);
    indicateApMode();

    IPAddress ip = WiFi.softAPIP();
    logStatus("AP IP: " + ip.toString());
    Serial.print("SSID: ");
    Serial.println(apSsid);
    Serial.print("Password: ");
    Serial.println(apPassword);
    Serial.print("AP IP address: ");
    Serial.println(maskIp(ip));

    dnsServer.start(53, "*", ip);

    server.on("/", HTTP_GET, handleRoot);
    server.on("/save", HTTP_POST, handleSave);
    server.on("/scan", HTTP_GET, handleScan);
    server.on("/generate_204", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Android
    server.on("/gen_204", HTTP_ANY, []() { sendCaptivePortalPage(); });      // Android alt
    server.on("/hotspot-detect.html", HTTP_ANY, []() { sendCaptivePortalPage(); }); // iOS/macOS
    server.on("/library/test/success.html", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Kindle
    server.on("/connecttest.txt", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Windows
    server.on("/ncsi.txt", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Windows NCSI
    server.on("/fwlink", HTTP_ANY, []() { sendCaptivePortalPage(); });   // Windows legacy
    server.onNotFound(handleNotFound);
    server.on("/status", HTTP_GET, []() {
        String json = "{\"connected\":";
        json += (WiFi.status() == WL_CONNECTED) ? "true" : "false";
        json += ",\"ip\":\"";
        json += (WiFi.status() == WL_CONNECTED) ? maskIp(WiFi.localIP()) : "";
        json += "\",\"message\":\"" + lastStatusMessage + "\"}";
        server.sendHeader("Cache-Control", "no-store");
        server.send(200, "application/json", json);
    });

    server.begin();
    portalActive = true;
    logStatus("Captive portal active");
}

void stopCaptivePortal() {
    if (portalActive) {
        dnsServer.stop();
        server.stop();
        WiFi.softAPdisconnect(true);
        portalActive = false;
        portalFromFailure = false;
        portalStartMs = 0;
        logStatus("Captive portal stopped.");
    }
}

bool sendToThingSpeak(float temp1, float temp2, float humidity, float pressure) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected, skipping ThingSpeak update");
        return false;
    }

    HTTPClient http;
    String url = String(thingspeakEndpoint) +
                 "?api_key=" + thingspeakApiKey +
                 "&field1=" + String(temp1, 2) +
                 "&field2=" + String(temp2, 2) +
                 "&field3=" + String(humidity, 2) +
                 "&field4=" + String(pressure, 2);

    http.begin(url);
    int httpCode = http.GET();

    if (httpCode > 0) {
        Serial.print("ThingSpeak response code: ");
        Serial.println(httpCode);
    } else {
        Serial.print("ThingSpeak request failed: ");
        Serial.println(http.errorToString(httpCode));
    }

    http.end();
    return httpCode > 0 && httpCode < 300;
}

void goToDeepSleep() {
    logStatus("Entering deep sleep for " + String(DEEP_SLEEP_SECONDS) + " seconds");
    statusPixel.setBrightness(STATUS_LED_SLEEP_BRIGHTNESS);
    setStatusLedColor(255, 255, 255); // dim white indicator before sleep
    waitWithBackground(200);
    statusLedOff();
    statusPixel.setBrightness(STATUS_LED_BRIGHTNESS);
    
    // Stop any active services
    stopCaptivePortal();
    
    // Disable WiFi completely
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    esp_wifi_stop();
    
    // Disable Bluetooth (release memory used by BT stack)
    esp_bt_controller_disable();
    
    // Configure wake-up timer
    esp_sleep_enable_timer_wakeup(DEEP_SLEEP_US);
    
    // Flush serial output before sleep
    Serial.println("Going to sleep now...");
    Serial.flush();
    
    // Enter deep sleep
    esp_deep_sleep_start();
}

void publishOnceThenSleep() {
    sensors_event_t humidity, temp;
    aht.getEvent(&humidity, &temp);

    float ahtTemp = temp.temperature;
    float bmpTemp = bmp.readTemperature();
    float relHumidity = humidity.relative_humidity;
    float pressure = bmp.readPressure() / 100.0;

    Serial.print("AHT20  Temp: ");
    Serial.print(ahtTemp);
    Serial.print(" °C  Humidity: ");
    Serial.print(relHumidity);
    Serial.println(" %");

    Serial.print("BMP280 Temp: ");
    Serial.print(bmpTemp);
    Serial.print(" °C  Pressure: ");
    Serial.print(pressure);
    Serial.println(" hPa");
    Serial.println("-----------------------------");

    if (WiFi.status() == WL_CONNECTED) {
        syncTimeFromNtp();
    }

    bool sent = sendToThingSpeak(ahtTemp, bmpTemp, relHumidity, pressure);
    bool writeOk = logReadingToSd(ahtTemp, bmpTemp, relHumidity, pressure, sent);
    indicateDataWrite(writeOk);
    goToDeepSleep();
}

void setup() {
    Serial.begin(115200);
    initStatusLed();
    
    pinMode(configButtonPin, INPUT_PULLUP);
    buttonLastState = digitalRead(configButtonPin);
    bool buttonHeldOnBoot = buttonLastState == LOW;
    indicatePowerOnWhite();
    
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

    prefs.begin("wifi", false);
    wifiFailureLatched = prefs.getBool(PREF_FAIL_LATCH, false);
    if (wifiFailureLatched) {
        indicateWifiDisconnected();
    } else {
        statusLedOff();
    }
    initSdCard();
    ensureDataFileExists();

    if (buttonHeldOnBoot) {
        logStatus("Config button held - starting captive portal");
        startCaptivePortal();
        return;
    }

    if (connectWithRetries(WIFI_MAX_ATTEMPTS, WIFI_RETRY_DELAY_MS)) {
        publishOnceThenSleep();
    } else {
        logStatus("WiFi retries exhausted - starting captive portal for 5 minutes");
        startCaptivePortal(true);
    }
}

void loop() {
    checkConfigButtonPress();

    // Handle captive portal requests if running
    if (portalActive) {
        dnsServer.processNextRequest();
        server.handleClient();
    }

    // If new credentials were saved, try to connect
    if (connectRequested) {
        connectRequested = false;
        logStatus("Trying saved credentials...");
        if (connectWithStoredCredentials(true)) {
            stopCaptivePortal();
            publishOnceThenSleep();
        }
    }

    // If portal is active and WiFi connected, publish once then sleep
    if (portalActive && WiFi.status() == WL_CONNECTED && !connectRequested) {
        stopCaptivePortal();
        publishOnceThenSleep();
    }

    // If portal was started after failed retries, limit its uptime before sleeping
    if (portalActive && portalFromFailure &&
        WiFi.status() != WL_CONNECTED &&
        !connectRequested &&
        (millis() - portalStartMs >= CAPTIVE_PORTAL_TIMEOUT_MS)) {
        logStatus("Captive portal timeout reached - going to deep sleep");
        stopCaptivePortal();
        goToDeepSleep();
    }
}
