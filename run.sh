#!/bin/bash

# Hentikan eksekusi jika terjadi error
set -e

echo "=== 1. Membuat Project React Native ==="
npx react-native@0.72.6 init AplikasiPrinter --version 0.72.6 --skip-install

cd AplikasiPrinter

echo "=== 2. Menginstal Dependensi Utama ==="
npm install --legacy-peer-deps

echo "=== 3. Menginstal Library Printer Bluetooth ==="
npm install tp-react-native-bluetooth-escpos-printer --save --legacy-peer-deps

echo "=== 4. Menyiapkan File App.tsx ==="
cat > App.tsx <<'EOF'
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  BluetoothEscposPrinter,
} from 'tp-react-native-bluetooth-escpos-printer';

const App = () => {
  const handlePrint = async () => {
    try {
      await BluetoothEscposPrinter.printerAlign(
        BluetoothEscposPrinter.ALIGN.CENTER
      );

      await BluetoothEscposPrinter.printText(
        "TES CETAK PRINTER\n\r",
        {
          encoding: 'GBK',
          codepage: 0,
          widthtimes: 1,
          heigthtimes: 1,
        }
      );

      await BluetoothEscposPrinter.printText(
        "--------------------------------\n\r",
        {}
      );

      await BluetoothEscposPrinter.printText(
        "Berhasil Terhubung!\n\r\n\r",
        {}
      );

      Alert.alert(
        "Berhasil",
        "Perintah cetak sudah dikirim."
      );
    } catch (error: any) {
      Alert.alert(
        "Gagal Cetak",
        error?.toString() ||
        "Error tidak diketahui"
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        Aplikasi Printer Bluetooth
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePrint}
      >
        <Text style={styles.buttonText}>
          Cetak Struk Tes
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default App;
EOF

echo "=== Selesai! Project siap di-build ==="
