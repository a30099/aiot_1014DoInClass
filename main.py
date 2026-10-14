import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression, LassoCV, ElasticNetCV
from sklearn.feature_selection import RFECV, SequentialFeatureSelector
from sklearn.metrics import mean_squared_error, r2_score
from statsmodels.stats.outliers_influence import variance_inflation_factor
import statsmodels.api as sm
from mlxtend.feature_selection import ExhaustiveFeatureSelector as EFS # 需要 pip install mlxtend

import warnings
warnings.filterwarnings('ignore')

# ==========================================
# CRISP-DM Phase 1: Business Understanding
# 目標: 預測 50 家新創公司的利潤 (Profit)，並找出最具影響力的特徵。
# ==========================================

# ==========================================
# CRISP-DM Phase 2: Data Understanding
# ==========================================
# 假設資料集名稱為 '50_Startups.csv'，請確認檔案在同一個目錄下
# df = pd.read_csv('50_Startups.csv')

# 這裡為展示用途，建立模擬資料結構 (請替換為實際讀取資料的程式碼)
np.random.seed(42)
data = {
    'R&D Spend': np.random.uniform(10000, 160000, 50),
    'Administration': np.random.uniform(50000, 150000, 50),
    'Marketing Spend': np.random.uniform(0, 400000, 50),
    'State': np.random.choice(['New York', 'California', 'Florida'], 50),
    'Profit': np.random.uniform(30000, 190000, 50) # Target
}
df = pd.DataFrame(data)

# ==========================================
# CRISP-DM Phase 3: Data Preparation
# ==========================================
# 處理類別變數 State，採用 Model B: 使用兩個 Dummies 並保留 Intercept (避免共線性)
# drop_first=True 會自動捨棄一個類別(例如 California)，留下 NY 和 FL
df_encoded = pd.get_dummies(df, columns=['State'], drop_first=True, dtype=int)

X = df_encoded.drop('Profit', axis=1)
y = df_encoded['Profit']

# 分割訓練集與測試集
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# VIF 計算 (共線性檢查)
def calculate_vif(X_data):
    vif_data = pd.DataFrame()
    vif_data["Feature"] = X_data.columns
    vif_data["VIF"] = [variance_inflation_factor(X_data.values, i) for i in range(X_data.shape[1])]
    return vif_data

print("--- Variance Inflation Factor (VIF) ---")
print(calculate_vif(X))
print("-" * 40)

# ==========================================
# CRISP-DM Phase 4: Modeling (整合 6 種模型)
# ==========================================

models = {}

# 1. Baseline Linear Regression
lr = LinearRegression()
lr.fit(X_train, y_train)
models['Baseline LR'] = {'model': lr, 'features': list(X.columns)}

# 2. LassoCV (L1 Regularization)
lasso = LassoCV(cv=5, random_state=42)
lasso.fit(X_train, y_train)
lasso_features = X.columns[lasso.coef_ != 0].tolist()
models['LassoCV'] = {'model': lasso, 'features': lasso_features}

# 3. RFECV (Recursive Feature Elimination with CV)
rfecv = RFECV(estimator=LinearRegression(), step=1, cv=5, scoring='neg_mean_squared_error')
rfecv.fit(X_train, y_train)
rfecv_features = X.columns[rfecv.support_].tolist()
# 使用選出的特徵重新訓練一個 LR 模型以便後續預測
rfecv_model = LinearRegression().fit(X_train[rfecv_features], y_train)
models['RFECV'] = {'model': rfecv_model, 'features': rfecv_features}

# 4. Sequential Forward Selection (SFS)
sfs = SequentialFeatureSelector(LinearRegression(), direction='forward', cv=5)
sfs.fit(X_train, y_train)
sfs_features = X.columns[sfs.get_support()].tolist()
sfs_model = LinearRegression().fit(X_train[sfs_features], y_train)
models['SFS (Forward)'] = {'model': sfs_model, 'features': sfs_features}

# 5. ElasticNetCV (L1 + L2 Regularization)
elastic = ElasticNetCV(cv=5, random_state=42)
elastic.fit(X_train, y_train)
elastic_features = X.columns[elastic.coef_ != 0].tolist()
models['ElasticNetCV'] = {'model': elastic, 'features': elastic_features}

# 6. Exhaustive Feature Selection (EFS)
# EFS 運算成本高，這裡設定 min_features=1, max_features=X.shape[1]
efs = EFS(LinearRegression(), min_features=1, max_features=len(X.columns), scoring='neg_mean_squared_error', cv=5)
efs.fit(X_train, y_train)
efs_features = list(efs.best_feature_names_)
efs_model = LinearRegression().fit(X_train[efs_features], y_train)
models['Exhaustive FS'] = {'model': efs_model, 'features': efs_features}

# ==========================================
# CRISP-DM Phase 5: Evaluation
# ==========================================
print("\n--- Model Evaluation ---")
results = []
for name, m_info in models.items():
    model = m_info['model']
    features = m_info['features']
    
    # 若該方法把所有特徵都淘汰了 (例如懲罰過大)，則預測平均值
    if not features:
        y_pred = np.full(shape=y_test.shape, fill_value=y_train.mean())
    else:
        # 對應使用的特徵進行預測
        if name in ['Baseline LR', 'LassoCV', 'ElasticNetCV']:
            y_pred = model.predict(X_test)
        else:
            y_pred = model.predict(X_test[features])
            
    r2 = r2_score(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    
    results.append({
        'Model': name,
        'R2 Score': r2,
        'MSE': mse,
        'Selected Features': len(features)
    })

results_df = pd.DataFrame(results)
print(results_df.to_string(index=False))

# 選擇表現最好的模型 (以 Baseline LR 為例繪圖，您也可以依據 R2 選擇最佳模型)
best_model_name = 'Baseline LR'
best_model = models[best_model_name]['model']
y_pred_best = best_model.predict(X_test)

# 計算 Top 10 Outliers (根據殘差 Residuals)
# 這裡我們計算所有資料的殘差來找出 Outliers
y_pred_all = best_model.predict(X)
residuals = np.abs(y - y_pred_all)
top_10_outliers_idx = residuals.nlargest(10).index
top_10_outliers = df.loc[top_10_outliers_idx]

print(f"\n--- Top 10 Outliers (Based on Residuals of {best_model_name}) ---")
print(top_10_outliers[['Profit']])

# 視覺化: Scatter Plot & Regression Line (預測值 vs 實際值)
plt.figure(figsize=(10, 6))
plt.scatter(y_test, y_pred_best, color='blue', alpha=0.6, label='Actual vs Predicted')

# 繪製完美預測基準線 (y = x)
min_val = min(y_test.min(), y_pred_best.min())
max_val = max(y_test.max(), y_pred_best.max())
plt.plot([min_val, max_val], [min_val, max_val], color='red', linestyle='--', linewidth=2, label='Perfect Regression Line')

# 標示出測試集中的 Outliers (若有)
test_outliers = [idx for idx in top_10_outliers_idx if idx in y_test.index]
if test_outliers:
    plt.scatter(y_test.loc[test_outliers], pd.Series(y_pred_best, index=y_test.index).loc[test_outliers], 
                color='orange', s=100, edgecolors='black', label='Top Outliers (in Test Set)')

plt.title(f'Actual vs Predicted Profit ({best_model_name})')
plt.xlabel('Actual Profit')
plt.ylabel('Predicted Profit')
plt.legend()
plt.grid(True, linestyle=':', alpha=0.7)
plt.savefig('actual_vs_predicted.png', dpi=300, bbox_inches='tight')
plt.show()

# ==========================================
# CRISP-DM Phase 6: Deployment
# (在此階段，您可以將最佳模型儲存為 .pkl 檔以供未來使用)
# ==========================================