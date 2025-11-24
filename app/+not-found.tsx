import { Link, Stack } from "expo-router";
import { MapPin } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <MapPin size={48} color="#8E8E93" />
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go back to map</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 16,
    backgroundColor: '#F2F2F7',
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: '#000',
  },
  link: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: "#fff",
  },
});
