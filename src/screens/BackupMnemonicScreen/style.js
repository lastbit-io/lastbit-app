import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  mnemonicColumnContainer: {
    marginHorizontal: 12,
  },
  mnemonicWordText: {
    fontFamily: 'Quicksand-Bold',
    marginVertical: 2,
    fontSize: 15,
    color: 'black',
  },
  textInput: {
    fontFamily: 'Quicksand-Bold',
    fontSize: 20,
    color: 'black',
  },
  quizItemContainer: {
    flexDirection: 'row',
    marginVertical: 20,
    width: '100%',
    alignItems: 'center',
  },
  optionText: {
    fontFamily: 'Quicksand-Medium',
    fontSize: 15,
    color: 'black',
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    justifyContent: 'center',
  },
  headerText: {
    fontFamily: 'Quicksand-Bold',
    fontSize: 20,
    color: 'black',
  },
  backImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: 'black',
  },
});
