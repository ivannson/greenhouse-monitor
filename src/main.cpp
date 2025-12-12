#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>

// Pin definitions for ESP32-C3-SuperMini
#define TEMP_SENSOR_PIN A0
#define HUMIDITY_SENSOR_PIN A1
#define LIGHT_SENSOR_PIN A2

// Optional: Button pin for entering configuration mode
#define CONFIG_BUTTON_PIN -1  // Change to your button pin if using a button

// WiFi configuration
#define AP_SSID "GreenhouseMonitor-Config"
#define AP_PASSWORD "config12345"
#define CONFIG_NAMESPACE "wifi_config"
#define SSID_KEY "ssid"
#define PASSWORD_KEY "password"

// Global objects
WebServer server(80);
DNSServer dnsServer;
Preferences preferences;
bool wifiConnected = false;
bool configMode = false;

// Sensor values
float temperature = 0.0;
float humidity = 0.0;
int lightLevel = 0;

// HTML page for WiFi configuration
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
    page += "<h1>🌱 WiFi Configuration</h1>";
    page += "<div class=\"info\">Select your WiFi network and enter the password</div>";
    page += "<form action=\"/save\" method=\"POST\">";
    page += "<div class=\"row\"><button type=\"button\" id=\"scanBtn\">Scan WiFi</button>";
    page += "<div style=\"flex:1\"><select id=\"networks\"><option>Scan to list networks</option></select>";
    page += "<div class=\"hint\">Pick a network to auto-fill the SSID</div></div></div>";
    page += "<input id=\"ssid\" type=\"text\" name=\"ssid\" placeholder=\"WiFi Network Name (SSID)\" required autofocus>";
    page += "<input id=\"password\" type=\"password\" name=\"password\" placeholder=\"WiFi Password\" required>";
    page += "<button type=\"submit\">Save & Connect</button>";
    page += "</form>";
    page += "<script>";
    page += "const scanBtn=document.getElementById('scanBtn');";
    page += "const select=document.getElementById('networks');";
    page += "const ssidInput=document.getElementById('ssid');";
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
    page += "window.addEventListener('load',scan);";
    page += "</script>";
    page += "</div></body></html>";
    return page;
}

void sendCaptivePortalPage() {
    server.sendHeader("Cache-Control", "no-store");
    server.send(200, "text/html", getConfigPage());
}

// Handle root page
void handleRoot() {
    Serial.println("Root page requested");
    sendCaptivePortalPage();
}

// Handle WiFi credentials save
void handleSave() {
    Serial.println("Save request received");
    if (server.hasArg("ssid") && server.hasArg("password")) {
        String ssid = server.arg("ssid");
        String password = server.arg("password");
        
        // Save credentials to preferences
        preferences.begin(CONFIG_NAMESPACE, false);
        preferences.putString(SSID_KEY, ssid);
        preferences.putString(PASSWORD_KEY, password);
        preferences.end();
        
        Serial.println("WiFi credentials saved:");
        Serial.println("SSID: " + ssid);
        Serial.println("Password: [hidden]");
        
        // Send success response
        String response = "<!DOCTYPE html><html><head><meta http-equiv='refresh' content='3;url=/'>";
        response += "<style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}";
        response += ".container{background:white;padding:30px;border-radius:10px;max-width:400px;margin:0 auto;}";
        response += ".success{color:#4CAF50;font-size:24px;margin:20px 0;}</style>";
        response += "</head><body><div class='container'>";
        response += "<div class='success'>✅ Credentials Saved!</div>";
        response += "<p>Connecting to WiFi...</p>";
        response += "<p>Device will restart in 3 seconds.</p></div></body></html>";
        server.send(200, "text/html", response);
        
        delay(2000);
        ESP.restart();
    } else {
        Serial.println("Missing SSID or password in request");
        server.send(400, "text/plain", "Missing SSID or password");
    }
}

// Handle 404 errors
void handleNotFound() {
    Serial.print("Redirecting unknown path to captive portal: ");
    Serial.println(server.uri());
    server.sendHeader("Location", "/", true);
    server.send(302, "text/plain", "");
}

// Handle WiFi scan for available networks
void handleScan() {
    Serial.println("WiFi scan requested");
    int n = WiFi.scanNetworks(false, true);
    // Deduplicate by SSID and keep the strongest signal
    String* ssids = new String[n];
    int* rssis = new int[n];
    bool* secures = new bool[n];
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

// Start Access Point mode with captive portal
void startAccessPoint() {
    Serial.println("Starting Access Point mode...");
    
    // Disconnect any existing WiFi connection
    WiFi.disconnect(true);
    delay(100);
    
    // Set WiFi mode to AP
    WiFi.mode(WIFI_AP_STA);
    delay(100);
    
    // Configure AP
    if (WiFi.softAP(AP_SSID, AP_PASSWORD)) {
        delay(500); // Give AP time to start
        
        IPAddress IP = WiFi.softAPIP();
        Serial.print("AP IP address: ");
        Serial.println(IP);
        Serial.print("SSID: ");
        Serial.println(AP_SSID);
        Serial.print("Password: ");
        Serial.println(AP_PASSWORD);
        Serial.println("Connect to this network and navigate to http://" + IP.toString());
        Serial.println("Or the captive portal should open automatically");
        
        // Start DNS server for captive portal
        dnsServer.start(53, "*", IP);
        
        // Register web server routes
        server.on("/", HTTP_GET, handleRoot);
        server.on("/save", HTTP_POST, handleSave);
        // Captive portal OS probes
        server.on("/generate_204", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Android
        server.on("/gen_204", HTTP_ANY, []() { sendCaptivePortalPage(); });      // Android alt
        server.on("/hotspot-detect.html", HTTP_ANY, []() { sendCaptivePortalPage(); }); // iOS/macOS
        server.on("/library/test/success.html", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Kindle
        server.on("/connecttest.txt", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Windows
        server.on("/ncsi.txt", HTTP_ANY, []() { sendCaptivePortalPage(); }); // Windows NCSI
        server.on("/fwlink", HTTP_ANY, []() { sendCaptivePortalPage(); });   // Windows legacy
        server.on("/scan", HTTP_GET, handleScan);
        server.onNotFound(handleNotFound);
        
        // Start web server
        server.begin();
        Serial.println("Web server started on port 80");
        Serial.println("Captive portal active");
    } else {
        Serial.println("Failed to start Access Point");
    }
}

// Connect to WiFi using stored credentials
bool connectToWiFi() {
    preferences.begin(CONFIG_NAMESPACE, true);
    String ssid = preferences.getString(SSID_KEY, "");
    String password = preferences.getString(PASSWORD_KEY, "");
    preferences.end();
    
    if (ssid.length() == 0) {
        Serial.println("No WiFi credentials found");
        return false;
    }
    
    Serial.println("Connecting to WiFi: " + ssid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("WiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
        return true;
    } else {
        Serial.println("WiFi connection failed");
        return false;
    }
}

void setup() {
    // Initialize serial communication
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n\n=== Greenhouse Monitor ===");
    Serial.println("ESP32-C3-SuperMini");
    Serial.println("========================");
    
    // Initialize sensor pins
    pinMode(TEMP_SENSOR_PIN, INPUT);
    pinMode(HUMIDITY_SENSOR_PIN, INPUT);
    pinMode(LIGHT_SENSOR_PIN, INPUT);
    
    // Initialize config button if defined
    if (CONFIG_BUTTON_PIN >= 0) {
        pinMode(CONFIG_BUTTON_PIN, INPUT_PULLUP);
        // Check if button is pressed at startup (LOW = pressed with INPUT_PULLUP)
        if (digitalRead(CONFIG_BUTTON_PIN) == LOW) {
            Serial.println("Config button pressed - entering configuration mode");
            configMode = true;
        }
    }
    
    // Try to connect to WiFi
    if (!configMode) {
        wifiConnected = connectToWiFi();
    }
    
    // If connection failed or config mode requested, start Access Point
    if (!wifiConnected || configMode) {
        startAccessPoint();
        configMode = true;
    }
    
    Serial.println("System initialized");
    if (wifiConnected) {
        Serial.println("WiFi Status: Connected");
    } else {
        Serial.println("WiFi Status: Configuration mode active");
    }
}

void loop() {
    if (configMode) {
        // Configuration mode - handle web server and DNS
        dnsServer.processNextRequest();
        server.handleClient();
        delay(10);
    } else {
        // Normal operation mode - read sensors
        // Check WiFi connection status
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("WiFi disconnected, attempting reconnect...");
            wifiConnected = connectToWiFi();
            if (!wifiConnected) {
                Serial.println("Reconnection failed, starting config portal...");
                startAccessPoint();
                configMode = true;
            }
        }
        
        // Read sensor values
        int tempRaw = analogRead(TEMP_SENSOR_PIN);
        int humidityRaw = analogRead(HUMIDITY_SENSOR_PIN);
        int lightRaw = analogRead(LIGHT_SENSOR_PIN);
        
        // Convert analog readings to actual values
        temperature = (tempRaw / 4095.0) * 50.0; // Example: 0-50°C range
        humidity = (humidityRaw / 4095.0) * 100.0; // Example: 0-100% range
        lightLevel = map(lightRaw, 0, 4095, 0, 1000); // Example: 0-1000 lux
        
        // Print sensor data
        Serial.println("=== Sensor Readings ===");
        Serial.print("Temperature: ");
        Serial.print(temperature, 1);
        Serial.println(" °C");
        
        Serial.print("Humidity: ");
        Serial.print(humidity, 1);
        Serial.println(" %");
        
        Serial.print("Light Level: ");
        Serial.print(lightLevel);
        Serial.println(" lux");
        Serial.println();
        
        delay(5000); // Read every 5 seconds
    }
}
