# Overview "setlist"
* HTML/JS application to step through a setlist of songs
* intended for the Kemper Profiler Player being connected via USB to a Windows tablet (Intel or Snapdragon)
* use a webserver to serve "Setlist.html" (so you only have to grant MIDI permission once) - e.g. nodejs => http-server
* point browser to http://localhost:8080

# Basic Concepts

## Display Modes 
* 2 displayModes: MODE_SETLIST (default) and MODE_PRESET
* when switching from
  * SETLIST to PRESET: the preset selected by the last song selected in the setlist is selected
  * PRESET to SETLIST: the last song that has been selected in the setlist (before switching) is selected
* on preset change (via songlist or presetlist):
  * effect buttons are reset

## MIDI
* INBOUND MIDI Program Change messages are mapped to either songs in the setlist or presets, depending on the mode (PC OUTBOUND)
* INBOUND MIDI Program Change messages are also used for tuner and effect buttons (CC OUTBOUND)

## setlist.json
* JSON file with 1 list of all presets and multiple setlists
* Setlist and preset data is loaded from a JSON file and rendered in the UI
* contents:
  * `cfg`
    * configure the 5 Bread & Butter presets (must be in one bank)
  * `presets`
    * work in progress - target: show effect button settings per preset when song is selected
    * you can configure the "contents" of each effect button and it will be shown when a song or a preset is selected
  * `songs`
    * list of songs, each with a preset - PREV/NEXT step through the list

## SOLO button
* ON : switch to SOLO-BANK + SOLO-PRESET and change to PRESET MODE
* OFF: switch back to SONG or PRESET that was selected when SOLO was pressed


# Advanced Concepts

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

## 2 Options to use the M-VAVE (Chocolate) "footctrl" on a Windows tablet

1. Use a USB-hub and plugin the "USB Stick" (USB-A plug) that is available with the M-VAVE. It is recognized as Blueetooth controller directly (i.e. you don't need any additional software).
  Do NOT connect FootCtrl to your tablet!

2. Connect the FootCtrl via Bluetooth directly. In that case FootCtrl is not recognise as controller and you need to make it available via:
* install+run loopMIDI to create a loop-back-port
* install+run MIDIberry and send input from "FootCtrl (Bluetooth MIDI IN)" to "loopMIDI Port [1]"
* https://www.tobias-erichsen.de/wp-content/uploads/2020/01/loopMIDISetup_1_0_16_27.zip

## Prevent WINDOWS from putting USB ports to sleep mode

* Open Device Manager
* Find Universal Serial Bus controllers
* Right-click your USB Root Hubs > Properties > Power Management
* Uncheck "Allow the computer to turn off this device to save power."

