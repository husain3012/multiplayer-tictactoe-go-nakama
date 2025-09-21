// App.tsx
import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'react-native';

import { RootStackParamList } from './src/navigation/types';
import HomeScreen from './src/screens/HomeScreen';
import MatchmakingScreen from './src/screens/MatchmakingScreen';
import GameScreen from './src/screens/GameScreen';
import { colors } from './src/theme'; // Import our custom colors

const Stack = createStackNavigator<RootStackParamList>();

// Customize the default dark theme
const MyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.primary,
  },
};

const App: React.FC = () => {
  return (
    <>
      <StatusBar barStyle="light-content" />
      <NavigationContainer theme={MyDarkTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Matchmaking" component={MatchmakingScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;
