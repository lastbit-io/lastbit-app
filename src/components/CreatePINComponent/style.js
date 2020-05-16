import { StyleSheet } from 'react-native';
import config from 'config';

export default StyleSheet.create({
  mneminicWordText: {
    fontFamily: 'Quicksand-Bold',
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
    marginVertical: 5,
    width: '100%',
    alignItems: 'center',
  },
  optionText: {
    fontFamily: 'Quicksand-Medium',
    fontSize: 15,
    color: 'black',
  },
  pasteButton: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
