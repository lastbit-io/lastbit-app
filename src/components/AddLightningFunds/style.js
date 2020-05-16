import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  deviceTitleText: {
    fontFamily: 'Quicksand-Bold',
    fontSize: 20,
    color: 'black',
  },
  availableFundsContainer: {
    flexDirection: 'row',
    marginTop: 15,
  },
  availableFundsText: {
    fontFamily: 'Quicksand-Medium',
    fontSize: 15,
    color: 'black',
  },
  instructionsText: {
    fontFamily: 'Quicksand-Regular',
    fontSize: 12,
    color: 'black',
    marginTop: 10,
  },
  amountTextInput: {
    fontFamily: 'Quicksand-Regular',
    fontSize: 15,
    // height:40,
    color: 'black',
    borderBottomColor: 'black',
    borderBottomWidth: 1,
    padding: 10,
    // flex: 1
  },
  borderedTouchable: {
    marginTop: 20,
    padding: 10,
    borderColor: 'black',
    borderWidth: 1,
  },
  borderedTouchableText: {
    fontFamily: 'Quicksand-Medium',
    fontSize: 12,
    color: 'black',
  },
  toggleButtonTouchable: {
    padding: 10,
    backgroundColor: 'whitesmoke',
    flexDirection: 'row',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderColor: 'lightgray',
    borderWidth: 1,
  },
  toggleButtonText: {
    fontFamily: 'Quicksand-Medium',
    marginLeft: 2,
    fontSize: 16,
    color: '#2F2F2F',
  },
  spinner: {
    marginTop: 6,
    marginLeft: 12,
  },
  textInlineBtnContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  inlineBtn: {
    flex: 1,
    marginLeft: 12,
    borderWidth: 1,
    height: 45,
    width: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#dedede',
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
    tintColor: '#6495ed',
  },
});
