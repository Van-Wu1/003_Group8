import requests
import json

api_url = "https://www.unitestudents.com/api/configurator/searchResults"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

# 搞个遍历
cities = ["AB","BA","BI","BH","BS","CF","CV","DH","EH","GL","LD","LC","LV","LE","LG","MC","MD","NE","NG","OX","PO","SF","SH"] 

# 存储所有爬取数据
all_properties = []

for city in cities:
    print(f"正在爬取 {city} ...")
    
    payload = {
        "academicYear": "25/26",
        "city": city,
        "lengthOfStay": "Full Year,Academic Year",
        "property": None,
        "roomTypes": None,
        "stlEndDate": None,
        "stlStartDate": None,
        "university": None
    }

    response = requests.post(api_url, headers=headers, json=payload)

    if response.status_code == 200:
        data = response.json()

        for prop in data["data"]["propertyDataList"]:
            name = prop["propertyName"]
            lat = prop.get("latitude")
            lon = prop.get("longitude")

            if lat and lon:
                all_properties.append({
                    "name": name,
                    "latitude": lat,
                    "longitude": lon,
                    "city": city # 加个城市名字不知道有没有用
                })

        print(f"{city} 爬取完成，共 {len(data['data']['propertyDataList'])} 条数据")

    else:
        print(f"{city} API 请求失败fuck，状态码: {response.status_code}")

# 生成 JavaScript 格式的数据
js_content = f"const propertyData = {json.dumps(all_properties, indent=4)};\n\nexport default propertyData;"

# 保存 USdata.js 文件
with open("./src/js/data/property.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Done!!!!!oioioioio!!!")
