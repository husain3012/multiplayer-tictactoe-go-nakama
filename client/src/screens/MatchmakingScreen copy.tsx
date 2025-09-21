import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MatchmakerMatched } from '@heroiclabs/nakama-js';

import NakamaService from '../services/NakamaService';
import { HomeScreenNavigationProp } from '../navigation/types';

const MatchmakingScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [matchmakingTicket, setMatchmakingTicket] = useState<string | null>(null);

  useEffect(() => {
    const startMatchmaking = async () => {
      console.log("Starting matchmaking...");
      try {
        const matched = await NakamaService.findMatch();
        console.log("Matched:", matched);
        // The promise from findMatch resolves when onmatchmakermatched is triggered
        if (matched.match_id) {
          navigation.navigate('Game', { matchId: matched.match_id });
        } else {
          // In some cases, like direct invites, you might not get a match_id immediately.
          // For this simple matchmaking, we always expect one.
          setMatchmakingTicket(matched.ticket);
        }
      } catch (error) {
        console.error("Matchmaking failed:", error);
        Alert.alert("Matchmaking Error", "Could not find a match. Please try again.");
        navigation.goBack();
      }
    };

    startMatchmaking();

    // Handle the hardware back button on Android
    const backAction = () => {
      if (matchmakingTicket) {
        NakamaService.leaveMatchmaker(matchmakingTicket);
      }
      navigation.goBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    // This is the cleanup function that runs when the screen is unmounted
    return () => {
        backHandler.remove();
        // Remove the listener to prevent memory leaks
        if (NakamaService.socket) {
            NakamaService.socket.onmatchmakermatched = () => {};
        }
    };
  }, [navigation, matchmakingTicket]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.text}>Finding Opponent...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F7' },
  text: { marginTop: 20, fontSize: 18, color: '#666' },
});

export default MatchmakingScreen;