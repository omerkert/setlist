# setlist
* HTML/JS application to step through a setlist of songs
* intended for the Kemper Profiler Player being connected via USB to a Windows tablet (Intel or Snapdragon)

* use a webserver to serve "Setlist.html" (so you only have to grant MIDI permission once) - e.g. nodejs => http-server
* point browser to http://localhost:8080

## Setlist.json
 * cfg
  * configure the 5 Bread & Butter presets (must be in one bank)
 * presets
  * work in progress - target: show effect button settings per preset when song is selected
 * songs
  * list of songs, each with a preset - PREV/NEXT step through the list

## recommended footcontroller => M-VAVE Chocolate
 * Bank 1
  * Button 1 => PREVIOUS Song
  * Button 2 => NEXT Song
  * Button 3 => MODE
  * Button 4 => SOLO
 * Bank 2
  * Button 1 => Effect Button I 
  * Button 2 => Effect Button II
  * Button 3 => Effect Button III
  * Button 4 => Effect Button IIII

## MODE Concept
 * toggle between 2 mode
 * First: Setlist Songs via PREVIOUS + NEXT
 * Second: 5 Bread & Butter presets in one bank (PREV+NEXT to step through) => configurable via JSON:
  * 1: CLEAN COMPRESSED
	* 2: CLEAN
	* 3: SOLO
	* 4: UNCLEAN
	* 5: CRUNCH

# 2 Options to use the M-VAVE (Chocolate) "footctrl" on a Windows tablet

  1. Use a USB-hub and plugin the "USB Stick" (USB-A plug) that is available with the M-VAVE. It is recognized as Blueetooth controller directly (i.e. you don't need any additional software).
  Do NOT connect FootCtrl to your tablet!

  2. Connect the FootCtrl via Bluetooth directly. In that case FootCtrl is not recognise as controller and you need to make it available via:
    + install+run loopMIDI to create a loop-back-port
    + install+run MIDIberry and send input from "FootCtrl (Bluetooth MIDI IN)" to "loopMIDI Port [1]"
    + https://www.tobias-erichsen.de/wp-content/uploads/2020/01/loopMIDISetup_1_0_16_27.zip

# Prevent WINDOWS from putting USB ports to sleep mode

* Open Device Manager
* Find Universal Serial Bus controllers
* Right-click your USB Root Hubs > Properties > Power Management
* Uncheck "Allow the computer to turn off this device to save power."
