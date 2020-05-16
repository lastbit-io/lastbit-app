import { StyleSheet } from 'react-native';

export default function(theme) {
  return StyleSheet.create({
    containerView: {
      flex: 1,
      backgroundColor: 'white',
    },
    safeAreaContainer: {
      flex: 1,
      backgroundColor: theme.SECONDARY_BACKGROUND_COLOR,
    },
    headerContentContainer: {
      padding: theme.CONTAINER_PADDING || 20,
      backgroundColor: 'white',
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
    settingsTitleText: {
      fontFamily: 'Quicksand-Regular',
      fontSize: theme.FONT_SIZE_MEDIUM,
      color: theme.SECONDARY_COLOR,
    },
    backImage: {
      width: 25,
      height: 25,
      resizeMode: 'contain',
      tintColor: 'black',
    },
  });
}
