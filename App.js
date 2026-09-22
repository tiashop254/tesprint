import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { NativeModules } from 'react-native';

const { CustomPrinter } = NativeModules;

export default function App() {
  const [macAddress, setMacAddress] = useState('00:11:22:33:44:55');
  const [pdfUri, setPdfUri] = useState(null);
  const [fileName, setFileName] = useState('');

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
      });
      setPdfUri(res.uri);
      setFileName(res.name);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Gagal memilih file PDF');
      }
    }
  };

  const handlePrint = async () => {
    if (!pdfUri) {
      Alert.alert('Peringatan', 'Pilih file PDF resi terlebih dahulu!');
      return;
    }
    if (!macAddress) {
      Alert.alert('Peringatan', 'Masukkan MAC Address Bluetooth Printer!');
      return;
    }

    try {
      const message = await CustomPrinter.printPdfUri(pdfUri, macAddress);
      Alert.alert('Sukses', message);
    } catch (error) {
      Alert.alert('Gagal Cetak', error.message || 'Terjadi kesalahan');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.content}>
        <Text style={styles.title}>Cetak Resi PDF Thermal</Text>
        <Text style={styles.subtitle}>Aplikasi Cetak Bluetooth 58mm</Text>

        <View style={styles.card}>
          <Text style={styles.label}>MAC Address Printer Bluetooth:</Text>
          <TextInput
            style={styles.input}
            placeholder="00:11:22:33:44:55"
            placeholderTextColor="#94a3b8"
            value={macAddress}
            onChangeText={setMacAddress}
          />

          <TouchableOpacity style={styles.btnPick} onPress={pickDocument}>
            <Text style={styles.btnPickText}>
              {fileName ? `📄 ${fileName}` : '📂 Pilih File PDF Resi'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnPrint} onPress={handlePrint}>
            <Text style={styles.btnPrintText}>🖨️ Cetak Sekarang</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 32 },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    elevation: 3,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 16,
  },
  btnPick: {
    backgroundColor: '#e2e8f0',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnPickText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  btnPrint: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrintText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});
