import { StyleSheet } from 'react-native';
import { isIphoneXorAbove } from '../../shared/HelpingMethods';

export default function(theme) {
  return StyleSheet.create({
    containerView: {
      flex: 1,
      backgroundColor: theme.SECONDARY_BACKGROUND_COLOR,
    },
    safeContainer: {
      flex: 1,
      backgroundColor: theme.PRIMARY_BACKGROUND_COLOR,
    },
    headerContentContainer: {
      padding: theme.CONTAINER_PADDING || 20,
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
    borderedTouchable: {
      marginTop: 20,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.PRIMARY_COLOR,
      backgroundColor: theme.PRIMARY_BACKGROUND_COLOR,
      // borderColor: 'black',
    },
    borderedTouchableText: {
      fontFamily: 'Quicksand-Medium',
      fontSize: 12,
      // color: 'black'
      color: theme.PRIMARY_COLOR,
    },
    transactionsContainer: {
      backgroundColor: theme.SECONDARY_BACKGROUND_COLOR,
      flex: 1,
    },
    availableFundsText: {
      fontFamily: 'QuickSand-Regular',
      fontSize: 12,
      color: theme.MUTED_COLOR || 'rgba(0,0,0,0.5)',
      textAlign: 'center',
      paddingTop: 10,
      paddingHorizontal: 20,
    },
    actionButtonContainer: {
      flexDirection: 'row',
      height: 80,
    },
    actionButton: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
    buttonText: {
      marginTop: 5,
      fontFamily: 'Quicksand-Medium',
      fontSize: 10,
      color: theme.PRIMARY_COLOR,
      color: theme.MUTED_COLOR,
    },
    buttonImage: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
      tintColor: theme.MUTED_COLOR,
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
    sendTextInput: {
      fontFamily: 'Quicksand-Regular',
      fontSize: 15,
      backgroundColor: theme.INPUT_CONTAINER_COLOR,
      borderRadius: 5,
      padding: 15,
      color: theme.INPUT_CONTAINER_INVERT_COLOR,
      backgroundColor: 'white',
      marginVertical: 10,
    },
    sendTextInputContainer: {
      paddingTop: theme.CONTAINER_PADDING,
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
    sendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scanCodeTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
    },
    qrImage: {
      height: 30,
      width: 30,
      resizeMode: 'contain',
      tintColor: theme.COLOR_INFO,
    },
    textInlineBtnContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    inlineBtn: {
      flex: 1,
      marginRight: 12,
      borderWidth: 1,
      height: 50,
      width: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      borderColor: '#dedede',
    },
    pasteImage: {
      height: 20,
      width: 20,
      resizeMode: 'contain',
    },
    shareLinkTouchable: {
      marginTop: 20,
      padding: 10,
      borderColor: theme.PRIMARY_COLOR,
      borderWidth: 1,
    },
    sharePaymentLinkText: {
      fontFamily: 'Quicksand-Medium',
      fontSize: 12,
      color: theme.PRIMARY_COLOR,
    },
    actionBtn: {
      padding: 10,
      borderColor: 'white',
      borderWidth: 1,
      marginBottom: 20,
    },
  });
}
