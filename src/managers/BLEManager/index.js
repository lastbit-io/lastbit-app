import React, { Component } from 'react';
// import { BleManager } from 'react-native-ble-plx'
import { Base64 } from 'js-base64';
import protobuf from 'protobufjs';
import { sha256 } from 'js-sha256';
import Reactotron from 'reactotron-react-native';
import CustomBase64 from './CustomBase64';
import { BLEContext } from '../StateManager/Contexts';

export class BLEProvider extends Component {

    constructor(props) {
        super(props);
        Reactotron.log('Constructor')

        this.componentDidMount = function () {
            Reactotron.log('Mounted BleManager')
            this.manager = new BleManager();
            this.subscription = this.manager.onStateChange((state) => {
                if (state === 'PoweredOn') {
                    this.scanAndConnect();
                    this.subscription.remove();
                }
            }, true);
            this.setState({ manager: this.manager })
            // this.writeProtobufData().done();
        }

        this.scanAndConnect = function () {
            Reactotron.log('Starting device scan')
            this.manager.startDeviceScan(null, null, async (error, device) => {
                if (error) {
                    alert(error);
                    return;
                }

                Reactotron.log({ device });

                if (device.name) {
                    if (device.name.startsWith('HODLER')) {
                        this.manager.stopDeviceScan();
                        await device.connect();
                        await device.discoverAllServicesAndCharacteristics();
                        let services = await device.services();
                        Reactotron.log(services);
                        this.getCharacteristics(services[2]).done();
                        this.setState({ services, connected: true });
                    }
                }
            });
        }

        this.getCharacteristics = async (serviceIndex) => {
            let service = this.state.services[serviceIndex];
            let characteristics = await service.characteristics();
            Reactotron.log(characteristics, this.state);
            this.setState({ characteristics });
        }

        this.readFromSelectedCharacteristic = async characteristic => await characteristic.read();
        this.writeFromSelectedCharacteristic = async characteristic => await characteristic.writeWithoutResponse(Base64.encode(this.state.sendText));

        this.startMonitoring = async () => {
            let characteristic = this.state.characteristics[this.state.selectedCharacteristic]
            Reactotron.log('Monitoring characteristic: ', characteristic);
            characteristic.monitor((error, characteristic) => {
                if (error) {
                    alert(error)
                } else {
                    this.setState({ receivedProtoBufMessage: this.state.receivedProtoBufMessage + this.base64ToBase16(characteristic.value) })
                }
            })
        }

        this.
            constructSighashSendString = (address, sighashes) => {
                let finalString = address
                let sighashStrings = []
                sighashes.forEach(sighash => {
                    sighashStrings.push(sighash.path + ',' + sighash.sighash)
                });
                finalString = finalString + ';' + sighashStrings.join(';')
                finalString = finalString.length + ';' + finalString

                let lengthString = 'RCV ' + finalString.length
                while (lengthString.length !== 10) {
                    lengthString = lengthString + '#'
                }
                // finalString = lengthString + finalString 
                return {
                    finalString,
                    lengthString
                }
            }

        this.writeProtobufData = async () => {

            let characteristic = this.state.characteristics[this.state.selectedCharacteristic]

            // let jsonDescriptor = require('./sample.json')
            var root = protobuf.Root.fromJSON(jsonDescriptor);

            let Book = root.lookupType('com.book.Book')
            let payload = {
                isbn: 500,
                title: this.state.transactionAmount,
                author: this.state.sendToAddress
            }
            let message = Book.create(payload)
            let buffer = Book.encode(message).finish()

            let sha = sha256.arrayBuffer(buffer)
            let shaArray = new Uint8Array(sha)
            let paddedArray = new Uint8Array([...buffer, shaArray[0], shaArray[1], shaArray[2], shaArray[3]])
            let length = paddedArray.length

            let hexLengthString = length.toString(16)

            if (hexLengthString.length > 4) {
                return
            } else {
                while (hexLengthString.length !== 4) {
                    hexLengthString = '0' + hexLengthString
                }
            }

            let finalByteArray = new Uint8Array(
                [
                    51,
                    parseInt(hexLengthString.substring(0, 2), 16),
                    parseInt(hexLengthString.substring(2, 4), 16),
                    ...paddedArray
                ]
            )

            Reactotron.log(finalByteArray)

            let temparray, chunk = 20;
            let promises = []


            for (let i = 0; i < finalByteArray.length; i += chunk) {
                temparray = finalByteArray.slice(i, i + chunk);
                str = this.base64ArrayBuffer(temparray)
                promises.push(characteristic.writeWithoutResponse(str))
            }

            await Promise.all(promises)
            alert('Data Sent')
        }

        this.base64ToBase16 = (base64) => {
            return CustomBase64.atob(base64)
                .split('')
                .map(function (aChar) {
                    return ('0' + aChar.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
                .toUpperCase(); // Per your example output
        }

        this.base64ArrayBuffer = (arrayBuffer) => {
            var base64 = ''
            var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

            var bytes = new Uint8Array(arrayBuffer)
            var byteLength = bytes.byteLength
            var byteRemainder = byteLength % 3
            var mainLength = byteLength - byteRemainder

            var a, b, c, d
            var chunk

            // Main loop deals with bytes in chunks of 3
            for (var i = 0; i < mainLength; i = i + 3) {
                // Combine the three bytes into a single integer
                chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

                // Use bitmasks to extract 6-bit segments from the triplet
                a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
                b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
                c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
                d = chunk & 63               // 63       = 2^6 - 1

                // Convert the raw binary segments to the appropriate ASCII encoding
                base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
            }

            // Deal with the remaining bytes and padding
            if (byteRemainder == 1) {
                chunk = bytes[mainLength]

                a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

                // Set the 4 least significant bits to zero
                b = (chunk & 3) << 4 // 3   = 2^2 - 1

                base64 += encodings[a] + encodings[b] + '=='
            } else if (byteRemainder == 2) {
                chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

                a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
                b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

                // Set the 2 least significant bits to zero
                c = (chunk & 15) << 2 // 15    = 2^4 - 1

                base64 += encodings[a] + encodings[b] + encodings[c] + '='
            }

            return base64
        }

        this.state = {
            connected: false,
            manager: this.manager,
            services: null,
            characteristics: null,
            selectedService: 0,
            selectedCharacteristic: 0,
            transactionAmount: '',
            sendToAddress: '',
            receivedProtoBufMessage: '',
            connect: this.scanAndConnect
        }
    }

    // multiWriteToSelectedCharacteristic = async () => {
    //     let characteristic = this.state.characteristics[this.state.selectedCharacteristic]
    //     let data = 'lorem ipsum dolor sit amet consectetur adipiscing elit Nunc at sagittis nisl quis ultricies mauris Nunc porttitor arcu tellus sit amet finibus velit elementum tempus In scelerisque diam non tempor hendrerit Curabitur sit amet egestas lorem Nulla eget ipsum massa Class aptent taciti sociosqu ad litora torquent per conubia nostra'.split(' ')
    //     let promises = []
    //     data.forEach(word => {
    //         promises.push(characteristic.writeWithoutResponse(Base64.encode(word)))
    //     })

    //     await Promise.all(promises)
    //     alert('Data Sent')

    // }

    componentWillUnmount() {
        this.subscription.remove()
    }

    render() {
        return (
            <BLEContext.Provider value={this.state}>
                {this.props.children}
            </BLEContext.Provider>
        )
    }
}

export const BLEConsumer = BLEContext.Consumer;
export {
    BLEContext
}