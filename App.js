import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  NativeModules,
  NativeEventEmitter,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';

const { CustomPrinter } = NativeModules;
const printerEventEmitter = new NativeEventEmitter(CustomPrinter);

export default function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  
  // State Pengaturan Cetak
  const [paperWidth, setPaperWidth] = useState('78');
  const [rotation, setRotation] = useState('0'); // 0, 90, 180, 270
  const [copies, setCopies] = useState('1');
  const [startPage, setStartPage] = useState('1');

  // State Status Real-time
  const [isPrinting, setIsPrinting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Siap mencetak');

  useEffect(() => {
    // Memuat daftar printer terhubung saat aplikasi dibuka
    scanDevices();

    // Event listener untuk menerima update progres cetak halaman demi halaman dari Java
    const subscription = printerEventEmitter.addListener('onPrintProgress', (event) => {
      setCurrentPage(event.currentPage);
      setTotalPages(event.totalPages);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Ambil daftar perangkat Bluetooth yang terpasang (paired)
  const scanDevices = async () => {
    try {
      if (!CustomPrinter) {
        Alert.alert('Error', 'Native module CustomPrinter tidak ditemukan!');
        return;
      }
      const list = await CustomPrinter.getPairedDevices();
      setDevices(list);
      if (list.length > 0 && !selectedDevice) {
        setSelectedDevice(list[0]); // Pilih perangkat pertama secara default
      }
    } catch (error) {
      Alert.alert('Error Bluetooth', error.message || 'Gagal memindai perangkat Bluetooth.');
    }
  };

  // Pilih file PDF resi
  const pickPdfFile = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
      });
      setSelectedPdf(res);
      // Reset hitungan saat file baru dipilih
      setCurrentPage(0);
      setTotalPages(0);
      setStartPage('1');
      setStatusMessage(`File dipilih: ${res.name}`);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error Document', 'Gagal memilih file PDF.');
      }
    }
  };

  // Jalankan Proses Cetak PDF Multi-Halaman
  const handlePrint = async () => {
    if (!selectedPdf) {
      Alert.alert('Peringatan', 'Silakan pilih file PDF resi terlebih dahulu.');
      return;
    }
    if (!selectedDevice) {
      Alert.alert('Peringatan', 'Silakan pilih printer Bluetooth.');
      return;
    }

    const startPageNum = parseInt(startPage, 10) || 1;
    const paperWidthNum = parseInt(paperWidth, 10) || 78;
    const rotationNum = parseInt(rotation, 10) || 0;
    const copiesNum = parseInt(copies, 10) || 1;

    try {
      setIsPrinting(true);
      setStatusMessage('Menghubungkan ke printer & memproses PDF...');

      const result = await CustomPrinter.printPdfWithOptions(
        selectedPdf.uri,
        selectedDevice.address,
        paperWidthNum,
        rotationNum,
        copiesNum,
        startPageNum
      );

      setIsPrinting(false);

      if (result.isCanceled) {
        setStatusMessage(`Cetak dibatalkan pada resi ke-${result.lastPrintedPage}`);
        Alert.alert('Dibatalkan', `Pencetakan dihentikan pada resi ke-${result.lastPrintedPage}.`);
        // Siapkan halaman berikutnya untuk melanjutkan
        setStartPage(String(result.lastPrintedPage + 1));
      } else {
        setStatusMessage(`Selesai! Berhasil mencetak ${result.totalPages} resi.`);
        Alert.alert('Sukses', `Semua resi (${result.totalPages} halaman) berhasil dicetak!`);
        setStartPage('1');
      }
    } catch (error) {
      setIsPrinting(false);
      const lastSuccess = currentPage > 0 ? currentPage : startPageNum - 1;
      const nextPage = lastSuccess + 1;
      
      setStatusMessage(`Koneksi terputus/error pada resi ke-${nextPage}`);
      setStartPage(String(nextPage)); // Otomatis atur halaman lanjutan jika printer mati/mati listrik

      Alert.alert(
        'Printer Terputus / Error',
        `Pencetakan terhenti di resi ke-${lastSuccess}.\n\nSilakan nyalakan printer/sambungkan kembali Bluetooth, lalu klik "Lanjutkan Cetak" dari halaman ke-${nextPage}.`
      );
    }
  };

  // Batalkan Proses Cetak
  const handleCancel = async () => {
    try {
      setStatusMessage('Membatalkan pencetakan...');
      await CustomPrinter.cancelPrint();
    } catch (error) {
      Alert.alert('Error', 'Gagal membatalkan proses cetak.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Printer Resi Multi-Halaman</Text>

        {/* --- SECTION 1: PILIH FILE PDF --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Dokumen Resi PDF</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={pickPdfFile} disabled={isPrinting}>
            <Text style={styles.btnText}>Pilih File PDF Resi</Text>
          </TouchableOpacity>
          <Text style={styles.fileInfo}>
            {selectedPdf ? `📄 ${selectedPdf.name}` : 'Belum ada file PDF dipilih'}
          </Text>
        </View>

        {/* --- SECTION 2: PILIH PRINTER BLUETOOTH --- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>2. Printer Bluetooth</Text>
            <TouchableOpacity onPress={scanDevices} disabled={isPrinting}>
              <Text style={styles.linkText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada perangkat terhubung. Sandingkan Bluetooth printer Anda terlebih dahulu.</Text>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.address}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isSelected = selectedDevice && selectedDevice.address === item.address;
                return (
                  <TouchableOpacity
                    style={[styles.deviceItem, isSelected && styles.deviceItemSelected]}
                    onPress={() => setSelectedDevice(item)}
                    disabled={isPrinting}>
                    <Text style={[styles.deviceName, isSelected && styles.textSelected]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.deviceAddress, isSelected && styles.textSelected]}>
                      {item.address}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {/* --- SECTION 3: PENGATURAN CETAK & RESUME --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Pengaturan Cetak</Text>
          
          <View style={styles.rowInput}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Lebar Paper (mm)</Text>
              <TextInput
                style={styles.input}
                value={paperWidth}
                onChangeText={setPaperWidth}
                keyboardType="numeric"
                editable={!isPrinting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rotasi (°)</Text>
              <TextInput
                style={styles.input}
                value={rotation}
                onChangeText={setRotation}
                keyboardType="numeric"
                placeholder="0 / 90 / 180"
                editable={!isPrinting}
              />
            </View>
          </View>

          <View style={styles.rowInput}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Jumlah Salinan</Text>
              <TextInput
                style={styles.input}
                value={copies}
                onChangeText={setCopies}
                keyboardType="numeric"
                editable={!isPrinting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: '#007AFF', fontWeight: 'bold' }]}>
                Mulai Hal. Ke-
              </Text>
              <TextInput
                style={[styles.input, styles.inputHighlight]}
                value={startPage}
                onChangeText={setStartPage}
                keyboardType="numeric"
                editable={!isPrinting}
              />
            </View>
          </View>
        </View>

        {/* --- SECTION 4: PROGRESS BAR & REALTIME COUNTER --- */}
        <View style={styles.cardStatus}>
          <Text style={styles.statusTitle}>Status Real-Time</Text>
          {isPrinting && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 5 }} />}
          
          <Text style={styles.counterText}>
            {totalPages > 0
              ? `Resi Berhasil Dicetak: ${currentPage} / ${totalPages}`
              : statusMessage}
          </Text>

          {/* BAR PENCETAKAN */}
          {totalPages > 0 && (
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, Math.round((currentPage / totalPages) * 100))}%` },
                ]}
              />
            </View>
          )}
        </View>

        {/* --- KONTROL TOMBOL UTAMA --- */}
        <View style={styles.actionContainer}>
          {!isPrinting ? (
            <TouchableOpacity style={styles.btnPrint} onPress={handlePrint}>
              <Text style={styles.btnPrintText}>
                {parseInt(startPage, 10) > 1 ? `Lanjutkan Cetak (Hal. ${startPage})` : 'Mulai Cetak Resi'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnCancel} onPress={handleCancel}>
              <Text style={styles.btnCancelText}>Batal Cetak</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scrollContent: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 12,
    color: '#1C1C1E',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2C3E50',
  },
  btnPrimary: {
    backgroundColor: '#3498DB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  fileInfo: {
    marginTop: 8,
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: '#888',
    marginVertical: 6,
  },
  deviceItem: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginBottom: 6,
  },
  deviceItemSelected: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#666',
  },
  textSelected: {
    color: '#FFFFFF',
  },
  rowInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inputGroup: {
    flex: 0.48,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  inputHighlight: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
    fontWeight: 'bold',
    color: '#007AFF',
  },
  cardStatus: {
    backgroundColor: '#EBF5FB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#AED6F1',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2980B9',
    marginBottom: 4,
  },
  counterText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B4F72',
    textAlign: 'center',
    marginVertical: 4,
  },
  progressBarBackground: {
    width: '100%',
    height: 10,
    backgroundColor: '#D4E6F1',
    borderRadius: 5,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#27AE60',
  },
  actionContainer: {
    marginTop: 6,
    marginBottom: 30,
  },
  btnPrint: {
    backgroundColor: '#27AE60',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
  },
  btnPrintText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnCancel: {
    backgroundColor: '#E74C3C',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
  },
  btnCancelText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
