import { StyleSheet } from 'react-native'

export default function (theme) {
    return StyleSheet.create({
        tileContainer: {
            flex: 1,
            alignItems: 'center',
            marginHorizontal: 5,
        },
        titleText: {
            fontFamily: 'Quicksand-Regular',
            fontSize: theme.FONT_SIZE_MEDIUM,
            textAlign: 'center',
            color: '#777777'
        },
        tileMainTextContent: {
            fontFamily: 'Quicksand-Bold',
            fontSize: 16,
            marginTop: 8,
            color: 'black'
        },
        subtitleText: {
            fontFamily: 'Quicksand-Regular',
            fontSize: 12,
            color: theme.MUTED_COLOR
        }
    })
}