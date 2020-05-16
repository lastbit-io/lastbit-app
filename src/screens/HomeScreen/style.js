import { StyleSheet } from 'react-native';
import { isIphoneXorAbove } from '../../shared/HelpingMethods';

export default function(theme) {
  return StyleSheet.create({
    containerView: {
      flex: 1,
      backgroundColor: theme.SECONDARY_BACKGROUND_COLOR,
    },
    safeContainer: {
      backgroundColor: theme.PRIMARY_BACKGROUND_COLOR,
    },
    headerContentContainer: {
      padding: theme.CONTAINER_PADDING,
    },
    nameContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    deviceTitleText: {
      fontFamily: 'Quicksand-Bold',
      fontSize: theme.FONT_SIZE_LARGE,
      color: theme.PRIMARY_COLOR,
    },
    deviceSubtitleText: {
      fontFamily: 'Quicksand-Regular',
      fontSize: theme.FONT_SIZE_SMALL,
      color: theme.MUTED_COLOR,
    },
    subTitleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    themesImage: {
      height: 40,
      width: 40,
      resizeMode: 'contain',
      tintColor: theme.MUTED_COLOR,
    },
    qrContainer: {
      marginTop: theme.CONTAINER_PADDING,
      alignItems: 'center',
    },
    actionButtonContainer: {
      paddingVertical: 10,
      flexDirection: 'row',
      height: 80,
    },
    centerActionButton: {
      flex: 1,
      borderLeftColor: theme.MUTED_COLOR,
      borderLeftWidth: 1,
      borderRightColor: theme.MUTED_COLOR,
      borderRightWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButton: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonImage: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
      tintColor: theme.MUTED_COLOR,
    },
    buttonText: {
      marginTop: 5,
      fontFamily: 'Quicksand-Medium',
      fontSize: 10,
      color: theme.PRIMARY_COLOR,
      color: theme.MUTED_COLOR,
    },
    getPaidText: {
      marginTop: 10,
      fontFamily: 'Quicksand-Medium',
      fontSize: 10,
      textAlign: 'center',
      color: theme.MUTED_COLOR,
    },
    balanceContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceTitleText: {
      fontFamily: 'Quicksand-Medium',
      color: theme.PRIMARY_COLOR,
      fontSize: theme.FONT_SIZE_XLARGE,
    },
    balanceSubtitleText: {
      fontFamily: 'Quicksand-Regular',
      fontSize: theme.FONT_SIZE_MEDIUM || 15,
      color: theme.PRIMARY_COLOR,
      marginTop: 10,
      textAlign: 'center',
    },
    goImage: {
      width: 25,
      height: 25,
      resizeMode: 'contain',
      marginLeft: 10,
    },
    transactionsContainer: {
      backgroundColor: 'black',
      flex: 1,
    },
    balanceActivityIndicator: {
      margin: 30,
    },
    sendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    emptyTransactionContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backImage: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.PRIMARY_COLOR,
    },
    backImageContainer: {
      height: 35,
      width: 35,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    inlineBtn: {
      flex: 1,
      marginLeft: 12,
      borderWidth: 1,
      height: 50,
      width: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      borderColor: '#dedede',
    },
    pasteImage: {
      width: 22,
      height: 22,
      resizeMode: 'contain',
    },
    sendTextInputContainer: {
      paddingTop: theme.CONTAINER_PADDING,
    },
    sendTextInput: {
      fontFamily: 'Quicksand-Regular',
      fontSize: 15,
      backgroundColor: theme.INPUT_CONTAINER_COLOR,
      color: theme.INPUT_CONTAINER_INVERT_COLOR,
      borderRadius: 5,
      padding: 10,
      marginVertical: 5,
    },
    textInlineBtnContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    scanCodeTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
    },
    scanCodeText: {
      fontFamily: 'Quicksand-Medium',
      fontSize: theme.FONT_SIZE_SMALL,
      textAlign: 'center',
      color: theme.INPUT_CONTAINER_INVERT_COLOR,
    },
    qrImage: {
      height: 30,
      width: 30,
      resizeMode: 'contain',
      tintColor: theme.COLOR_INFO,
    },
    feeText: {
      fontFamily: 'Quicksand-Medium',
      color: theme.MUTED_COLOR,
      fontSize: 12,
      marginTop: 8,
    },
    receiveQRContainer: {
      paddingTop: theme.CONTAINER_PADDING,
      alignItems: 'center',
    },
    sharePaymentLinkText: {
      fontFamily: 'Quicksand-Medium',
      fontSize: 12,
      color: theme.PRIMARY_COLOR,
    },
    shareLinkTouchable: {
      marginTop: 20,
      padding: 10,
      borderColor: theme.PRIMARY_COLOR,
      borderWidth: 1,
    },
    transactionPopupContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      flexDirection: 'column-reverse',
    },
    transactionPopupContentContainer: {
      backgroundColor: theme.PRIMARY_BACKGROUND_COLOR || 'white',
      padding: theme.CONTAINER_PADDING || 20,
      paddingBottom: isIphoneXorAbove() ? 44 : theme.CONTAINER_PADDING || 20,
    },
    transactionsDetailText: {
      fontFamily: 'Quicksand-Medium',
      fontSize: 15,
      color: theme.MUTED_COLOR || 'rgba(0,0,0,0.6)',
      marginTop: 10,
    },
    transactionInformationTitleText: {
      fontFamily: 'Quicksand-Bold',
      fontSize: 12,
    },
    activeAddressBtn: {
      height: 35,
      width: 35,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.15)',
      justifyContent: 'center',
    },
    activeAddressBtnContainer: {
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.1)',
      width: 80,
      height: 40,
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 20,
      paddingHorizontal: 5,
    },
    addressTypeIcon: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
      alignSelf: 'center',
    },
  });
}
