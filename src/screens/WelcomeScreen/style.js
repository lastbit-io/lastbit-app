import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  subtitleText: {
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
  headerContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  welcomeText: {
    fontSize: 15,
    margin: 15,
    marginTop: 40,
    marginBottom: 70,
    textAlign: 'justify',
    paddingHorizontal: '5%',
    color: '#666666',
    fontFamily: 'Quicksand-Medium',
  },
});
