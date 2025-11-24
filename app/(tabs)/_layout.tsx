import { Tabs } from "expo-router";
import { Map, History as HistoryIcon, Users, Settings as SettingsIcon } from "lucide-react-native";
import React from "react";
import { useSettings } from "@/contexts/SettingsContext";

export default function TabLayout() {
  const { isDarkMode } = useSettings();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: true,
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#1C1C1E' : '#fff',
          borderTopColor: isDarkMode ? '#38383A' : '#E5E5EA',
        },
        headerStyle: {
          backgroundColor: isDarkMode ? '#1C1C1E' : '#fff',
        },
        headerTintColor: isDarkMode ? '#fff' : '#000',
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          headerShown: false,
          tabBarIcon: ({ color }) => <Map size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <HistoryIcon size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="multiplayer"
        options={{
          title: "Multiplayer",
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <SettingsIcon size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
