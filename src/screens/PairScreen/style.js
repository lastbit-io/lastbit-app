import { StyleSheet } from 'react-native'

export default StyleSheet.create({
    safeAreaContainer: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white'
    },
    titleText: {
        marginTop: 20,
        fontFamily: 'Quicksand-Bold',
        textAlign: 'center',
        color: 'black',
        fontSize: 30
    },
    subTitleText: {
        marginTop: 20,
        fontFamily: 'Quicksand-Medium',
        textAlign: 'center',
        color: 'rgba(100,100,100,1)',
        fontSize: 15
    },
    animationContainerView: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    animationImage: {
        width: 200,
        height: 200,
        resizeMode: 'contain'
    },
    issuesText: {
        fontFamily: 'Quicksand-Regular',
        color: 'black',
        fontSize: 12,
        textAlign: 'justify',
        paddingVertical: 20
    }
})