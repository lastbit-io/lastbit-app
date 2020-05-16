# Mobile Bitcoin and Lightning Network Interface to the Lastbit Go device

This application was tested with a group of beta users on testnet only and connects to a c-lightning backend with an account management server running on top of c-lightning.

The goal of this application is to provide a single interface to a private bitcoin wallet and a hosted lightning wallet to begin sending/receiving instant bitcoin transactions over the lightning network with zero setup (At the risk of the user). The app additionally connects to a lastbit go device over BLE to sign and broadcast bitcoin transactions. Additional functionality to manage one's own lightning keys on this device is WIP.

A significantly improved application with a whole new set of features can be found on www.lastbit.io


<img src="/assets/screenshots/demo_2.gif"/>

### Screenshots

<p align="center">
  <img src="/assets/screenshots/screen_6.PNG"  height="455">
  <img src="/assets/screenshots/screen_3.PNG"  height="455">
  <img src="/assets/screenshots/screen_4.PNG"  height="455">
  <img src="/assets/screenshots/screen_1.PNG"  height="455">
  <img src="/assets/screenshots/screen_2.PNG"  height="455">
  <img src="/assets/screenshots/screen_5.PNG"  height="455">
</p>

(USE ON MAINNET AT YOUR OWN RISK)

### Usage

1. Clone this repository
2. Run `yarn install`
3. Run `react-native run-android` or `react-native run-ios`


### Contributing

THIS REPO IS A MIRROR OF LASTBIT INTERNAL REPOSITORIES AND A NEW VERSION OF THIS APPLICATION IS CURRENTLY BEING DEVELOPED. LASTBIT ALLOWS CONTRIBUTIONS WHICH WILL BE PORTED TO THE APPLICATION BUT WILL NOT MERGE PULL REQUESTS DIRECTLY.

- If you have found an issue in the project, open an issue on GitHub including a description of the bug and reproduction steps.
- If you have found a vulnerability in the project, please disclose responsibly to info@lastbit.io or reach out for any questions.