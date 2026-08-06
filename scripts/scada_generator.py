import math
import random
import psycopg2  # MySQL için: import mysql.connector as psycopg2

# 1. VERİTABANI BAĞLANTI AYARLARI
DB_CONFIG = {
    "dbname": "Defect Reverse-Tracker",
    "user": "postgres",
    "password": "***",
    "host": "localhost",
    "port": "5432"
}

# 2. SENSÖR TANIMLARI VE NOMİNAL DEĞERLERİ
SENSORS = [
    # Çelikhane
    {"name": "Fırın Sıcaklığı", "stage": "Çelikhane", "target": 1150, "unit": "°C", "type": "temp"},
    {"name": "Pota Sıcaklığı", "stage": "Çelikhane", "target": 1580, "unit": "°C", "type": "temp"},
    {"name": "Argon Akış Debisi", "stage": "Çelikhane", "target": 450, "unit": "L/dk", "type": "flow"},
    {"name": "Cüruf Kalınlığı", "stage": "Çelikhane", "target": 12, "unit": "mm", "type": "flow"},

    # Sıcak Haddehane
    {"name": "Hadde Merdane Sıcaklığı", "stage": "Sıcak Haddehane", "target": 880, "unit": "°C", "type": "temp"},
    {"name": "Şerit Çıkış Hızı", "stage": "Sıcak Haddehane", "target": 15, "unit": "m/s", "type": "pressure"},
    {"name": "Rulman Titreşimi", "stage": "Sıcak Haddehane", "target": 2.4, "unit": "mm/s", "type": "vibration"},
    {"name": "Emülsiyon Basıncı", "stage": "Sıcak Haddehane", "target": 6.5, "unit": "bar", "type": "pressure"},

    # Asitleme
    {"name": "Asit Banyo Sıcaklığı", "stage": "Asitleme", "target": 85, "unit": "°C", "type": "temp"},
    {"name": "Asit Konsantrasyonu (HCl)", "stage": "Asitleme", "target": 18, "unit": "%", "type": "flow"},
    {"name": "Tank pH Seviyesi", "stage": "Asitleme", "target": 1.2, "unit": "pH", "type": "flow"},
    {"name": "Sıyırıcı Rulo Basıncı", "stage": "Asitleme", "target": 4.2, "unit": "bar", "type": "pressure"},

    # Soğuk Haddehane
    {"name": "Şerit Gerginliği", "stage": "Soğuk Haddehane", "target": 125, "unit": "kN", "type": "pressure"},
    {"name": "Sac Çıkış Kalınlığı", "stage": "Soğuk Haddehane", "target": 1.5, "unit": "mm", "type": "pressure"},
    {"name": "X-Ray Kalınlık Sapması", "stage": "Soğuk Haddehane", "target": 0.02, "unit": "mm", "type": "vibration"},
    {"name": "Yağlama Debisi", "stage": "Soğuk Haddehane", "target": 18.5, "unit": "L/dk", "type": "flow"}
]

def generate_time_series(sensor, is_anomalous):
    """0 - 180 saniye arası 19 adet zaman serisi noktası üretir."""
    target = sensor["target"]
    s_type = sensor["type"]
    series = []

    for step in range(19):
        sec = step * 10  # 0, 10, 20, ... 180
        val = target

        if not is_anomalous:
            # Normal durum: Ufak rastgele gürültü (%1-2)
            noise = (random.random() - 0.5) * (target * 0.02)
            val = target + noise
        else:
            # Anomali durumu: Fiziksel türe göre 50-130. saniyeler arasında kırılma
            if s_type == "temp":
                # Sıcaklık anomalisinde ısınma/soğuma eğrisi
                drift = (step / 18) * (target * 0.25)
                val = target + drift + random.uniform(-2, 2)
            elif s_type == "pressure":
                # Basınç ve gerginlikte ani düşüş/yükseliş dalgası
                if 5 <= step <= 13:
                    val = target * 1.28 + random.uniform(-1, 1)
                else:
                    val = target + random.uniform(-0.5, 0.5)
            elif s_type == "vibration":
                # Titreşimde zigzag / testere dişi gürültü
                noise = random.uniform(target * 0.2, target * 0.6)
                val = target + noise if step >= 6 else target
            else:
                # Akış ve pH kayması (Drift)
                val = target * (1 - (step / 18) * 0.3) if step >= 4 else target

        series.append((sec, round(val, 2)))

    return series

def insert_batch_data(coil_id, anomalous_sensor_name):
    """Üretilen verileri veritabanına basar."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Önceki verileri temizle (Varsa)
        cursor.execute("DELETE FROM sensor_readings WHERE coil_id = %s;", (coil_id,))

        print(f"🔄 '{coil_id}' için 180 saniyelik zaman serisi verisi üretiliyor...")

        total_inserted = 0
        for sensor in SENSORS:
            is_anomalous = (sensor["name"] == anomalous_sensor_name)
            time_series = generate_time_series(sensor, is_anomalous)

            for sec, actual_val in time_series:
                status = "ANOMALI" if (is_anomalous and 50 <= sec <= 130) else "NORMAL"

                # Tablonuzdaki kolon adı 'time_second' olduğu için query güncellendi:
                query = """
                    INSERT INTO sensor_readings 
                    (coil_id, sensor_key, stage_name, time_second, actual_value, target_value, unit, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """
                cursor.execute(query, (
                    coil_id,
                    sensor["name"],
                    sensor["stage"],
                    sec,  # time_second alanına saniye değeri yazılıyor (0, 10, ... 180)
                    actual_val,
                    sensor["target"],
                    sensor["unit"],
                    status
                ))
                total_inserted += 1

        conn.commit()
        cursor.close()
        conn.close()
        print(f"✅ Başarılı! Toplam {total_inserted} adet zaman serisi kaydı ekledi.")

    except Exception as e:
        print(f"❌ Veritabanı Hatası: {e}")

# 3. VERİ ÜRETİMİNİ TETİKLE
if __name__ == "__main__":
    # Test Senaryosu: BOBIN-2026-9041 için 'Fırın Sıcaklığı' sensörüne anomali verisi üret
    insert_batch_data("BOBIN-2026-9043", "Fırın Sıcaklığı")
