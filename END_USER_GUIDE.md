# Greenhouse Monitor End-User Guide

This guide is for using the greenhouse monitor after it has already been assembled and programmed.

## What It Does

The greenhouse monitor checks the greenhouse conditions automatically.

It measures:

- Temperature
- Humidity
- Air pressure

It then saves the reading on the memory card and, when WiFi is working, sends the reading online.

The device usually wakes up, takes one reading, saves it, sends it if possible, and then goes back to sleep for about 10 minutes.

## The Status Light

The small status light tells you what the monitor is doing.

| Light | Meaning |
| --- | --- |
| White when turned on | The monitor has started. |
| No light | The monitor is sleeping or idle. This is normal. |
| Green | WiFi connected, or the reading was saved successfully. |
| Flashing red and white | The monitor is trying WiFi again. |
| Red | WiFi has failed several times. |
| Blue | WiFi setup mode is open. |
| Purple | The reading could not be saved to the memory card. |
| Dim white briefly | The monitor is about to sleep. |

## The Setup Button

The setup button is used when you need to connect the monitor to WiFi.

| What you do | What happens |
| --- | --- |
| Hold the button while turning the monitor on | WiFi setup mode starts immediately. |
| Press the button while the monitor is awake | WiFi setup mode starts. |
| Press the button while the monitor is sleeping | Nothing happens until it wakes. To force setup, hold the button while restarting it. |

## First Setup

Use this when the monitor has never been connected to your WiFi before.

1. Turn the monitor off.
2. Hold the setup button.
3. While holding the button, turn the monitor on.
4. Release the button when the light turns blue.
5. On your phone or computer, open the WiFi settings.
6. Connect to this WiFi network:

   ```text
   greenhouse-temperature-setup
   ```

   It does not need a password.

7. A setup page should open automatically.
8. If no page opens, open a browser and go to:

   ```text
   http://192.168.4.1
   ```

9. Press **Scan WiFi**.
10. Choose your home, greenhouse, or site WiFi network.
11. Enter the WiFi password.
12. Press **Save & Connect**.

When the connection works, the light turns green. The monitor then takes a reading and goes to sleep.

## Normal Use

Most of the time, you do not need to do anything.

When the monitor already knows the WiFi network:

1. It wakes up.
2. It connects to WiFi.
3. It takes a reading.
4. It saves the reading.
5. It sends the reading online if WiFi is working.
6. It sleeps for about 10 minutes.

While sleeping, the light is usually off.

## If WiFi Is Working

If the saved WiFi network is available and the password is correct, the monitor connects by itself.

You may briefly see:

- White at startup
- Green after WiFi connects
- Green again after the reading is saved
- Dim white before sleep
- No light while sleeping

This is normal.

## If WiFi Is Not Working

If the router is off, the password changed, or the monitor is too far away, the monitor will try to reconnect several times.

You may see:

- Flashing red and white while it waits and retries
- Red after several failed tries
- Blue when it opens WiFi setup mode

When the light is blue, you can set up WiFi again:

1. Connect your phone or computer to `greenhouse-temperature-setup`.
2. Open the setup page if it does not open automatically.
3. Choose the correct WiFi network.
4. Enter the current WiFi password.
5. Press **Save & Connect**.

If nobody sets up WiFi, the monitor keeps setup mode open for about 5 minutes, then goes back to sleep. It will try again when it wakes up.

## If No WiFi Has Been Saved Yet

If the monitor has never been set up, it does not know which WiFi network to use.

The easiest way to handle this is:

1. Turn it off.
2. Hold the setup button.
3. Turn it on while holding the button.
4. Wait for the blue light.
5. Complete the WiFi setup.

If you do not hold the button at startup, the monitor may spend some time trying to connect before setup mode appears.

## If Your WiFi Network Does Not Appear

On the setup page, press **Scan WiFi** again.

If your network still does not appear:

- Move the monitor closer to the router.
- Check that the router is turned on.
- Check that the network is 2.4 GHz. The monitor cannot use 5 GHz-only WiFi.
- If the WiFi network is hidden, type its name manually.
- Make sure you are entering the WiFi password correctly.

## Changing WiFi

Use this when the monitor needs to move to a different WiFi network, or when the WiFi password changes.

1. Restart the monitor while holding the setup button.
2. Wait for the blue light.
3. Connect your phone or computer to `greenhouse-temperature-setup`.
4. Open the setup page.
5. Enter the new WiFi details.
6. Press **Save & Connect**.

The new WiFi details replace the old ones.

## Memory Card

The monitor saves readings to the memory card.

If the light turns purple, the reading could not be saved. Check that:

- The memory card is inserted.
- The memory card is not damaged.
- The monitor has been restarted after inserting the card.

The monitor may still send readings online if WiFi is working, even when the memory card has a problem.

## Quick Troubleshooting

| Problem | What to do |
| --- | --- |
| Light is off | This is usually normal. The monitor is probably sleeping. |
| Light is red | WiFi is not connecting. Restart with the setup button held down and enter WiFi again. |
| Light is blue | Setup mode is open. Connect to `greenhouse-temperature-setup`. |
| Light is purple | Check the memory card. |
| Setup page does not open | Open `http://192.168.4.1` in a browser while connected to `greenhouse-temperature-setup`. |
| WiFi does not show in the list | Move closer to the router, scan again, or type the WiFi name manually. |
| Monitor does not react to the button | It may be sleeping. Restart it while holding the setup button. |

## What Is Normal

These are normal and do not mean the monitor is broken:

- The light is off most of the time.
- The monitor only wakes about every 10 minutes.
- The setup page is not available while the monitor is sleeping.
- The button may not respond while the monitor is sleeping.
- The monitor can save readings even when online upload fails.
