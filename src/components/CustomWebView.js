import React, { Component } from 'react';
import {
  Dimensions,
  Clipboard,
  View,
  Image,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import LightningManager from 'lightning-manager';

const { width } = Dimensions.get('window');

class CustomWebView extends Component {
  static contextType = CombinedContext;

  state = {
    depositLightningAddress: '',
    addressType: 'bitcoin',
  };

  componentDidMount() {
    this.fetchFundingAddress();
  }

  fetchFundingAddress = async () => {
    const address = await LightningManager.getFundingAddress();
    if (address) {
      this.setState({ depositLightningAddress: address });
    }
  };

  render() {
    const { style, receivingAddress } = this.props;
    const { addressType, depositLightningAddress } = this.state;
    return (
      <>
        <View
          style={{
            marginHorizontal: 20,
            marginVertical: 20,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={style.deviceTitleText}>Your Address</Text>
            <View style={style.activeAddressBtnContainer}>
              <TouchableOpacity
                onPress={() => {
                  this.setState({
                    addressType: 'bitcoin',
                  });
                }}
                style={addressType === 'bitcoin' ? style.activeAddressBtn : {}}
              >
                <Image
                  style={[style.addressTypeIcon, { marginTop: 2 }]}
                  source={require('../../assets/images/btc.png')}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  this.setState({
                    addressType: 'lightning',
                  });
                }}
                style={
                  addressType === 'lightning' ? style.activeAddressBtn : {}
                }
              >
                <Image
                  style={style.addressTypeIcon}
                  source={require('../../assets/images/lightning.png')}
                />
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={[style.scanCodeText, { textAlign: 'left' }]}>
              {addressType === 'bitcoin'
                ? receivingAddress
                : depositLightningAddress}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (addressType === 'bitcoin') {
                  Clipboard.setString(receivingAddress);
                } else {
                  Clipboard.setString(depositLightningAddress);
                }
                window.EventBus.trigger('showDropdownAlert', {
                  type: 'info',
                  title: 'Address copied!',
                  message:
                    'Your current address has been copied to your clipboard.',
                });
              }}
            >
              <Icon
                name="content-copy"
                size={25}
                color={this.context.theme.PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
        </View>
        <WebView
          style={{
            flex: 1,
            height: 700,
            width: width - 20,
            marginLeft: 10,
            padding: 1,
          }}
          startInLoadingState
          allowFileAccess
          javaScriptEnabled
          showsVerticalScrollIndicator={false}
          originWhitelist={['*']}
          useWebKit
          source={{
            html: `
                  <!DOCTYPE html>
                  <html>
                      <head>
                          <meta charset="utf-8">
                          <meta name="viewport" content="initial-scale=1, maximum-scale=1">
                      </head>
                      <body>
                      <iframe src="https://verify.testwyre.com/widget/v1?env=test&operation=debitcard&accountId=AC_HNXBWJM99H7&authType=secretKey&destCurrency=BTC&sourceCurrency=USD&sourceAmount=0.01&dest=bitcoin:moXVWyQtRUJ9Fxi67pPkivJ4Wsu2WafCSv&redirectUrl=https://sendwyre.com" width="${width -
                        40}" height="600" frameborder="0"></iframe>
                      </body>
                  </html>
              `,
          }}
        />
      </>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <CustomWebView {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
