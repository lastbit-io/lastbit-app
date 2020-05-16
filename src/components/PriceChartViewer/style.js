import { StyleSheet } from 'react-native';

export default function(theme) {
  return StyleSheet.create({
    sendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    deviceTitleText: {
      fontFamily: 'Quicksand-Bold',
      fontSize: 20,
      color: theme.PRIMARY_COLOR,
    },
    deviceSubtitleText: {
      fontFamily: 'Quicksand-Regular',
      fontSize: 12,
      color: theme.MUTED_COLOR,
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
    coinImg: {
      width: 40,
      height: 40,
      paddingLeft: 10,
      marginTop: 5,
      marginRight: 10,
      resizeMode: 'contain',
    },
    coinTitle: {
      fontFamily: 'Quicksand-Bold',
      fontSize: 20,
      color: theme.PRIMARY_COLOR,
    },
    coinDelta: {
      fontFamily: 'Quicksand-Medium',
      fontSize: 15,
    },
    positiveChange: {
      color: theme.COLOR_SUCCESS,
    },
    negativeChange: {
      color: theme.COLOR_ERROR,
    },
    chartWrapper: {
      flex: 1,
      alignItems: 'center',
      overflow: 'hidden',
      // paddingBottom:30,
    },
    btnSelected: {
      borderRadius: 30,
      backgroundColor: '#FFFFFF',
    },
    btnUnselected: {
      height: 40,
      width: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 8,
      marginHorizontal: 10,
      borderTopWidth: 1,
      borderTopColor: '#999999',
      backgroundColor: '#3c3b3c',
      borderRadius: 25,
      alignItems: 'center',
      height: 55,
    },
  });
}
