import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { accountsApi, transactionsApi } from "../lib/api.js";

export default function TransactionForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: accountsApi.list,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      accountId: "",
      amount: 0,
      type: "expense",
      description: "",
      category: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const mutation = useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      navigate("/transactions");
    },
  });

  return (
    <div>
      <h2>新增交易</h2>
      <form
        onSubmit={handleSubmit((data) =>
          mutation.mutate({
            ...data,
            type: data.type as "income" | "expense" | "transfer",
            amount: Number(data.amount),
          }),
        )}
        className="form"
      >
        <div className="form-field">
          <label>类型</label>
          <select {...register("type")}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
            <option value="transfer">转账</option>
          </select>
        </div>
        <div className="form-field">
          <label>账户 *</label>
          <select {...register("accountId", { required: "请选择账户" })}>
            <option value="">请选择</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {errors.accountId && <span className="error">{errors.accountId.message}</span>}
        </div>
        <div className="form-field">
          <label>金额（分）*</label>
          <input
            type="number"
            {...register("amount", {
              required: "请输入金额",
              min: { value: 1, message: "金额必须大于 0" },
            })}
          />
          {errors.amount && <span className="error">{errors.amount.message}</span>}
        </div>
        <div className="form-field">
          <label>日期</label>
          <input type="date" {...register("date")} />
        </div>
        <div className="form-field">
          <label>描述</label>
          <input {...register("description")} />
        </div>
        <div className="form-field">
          <label>分类</label>
          <input {...register("category")} placeholder="如：餐饮、交通、工资" />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "创建中..." : "创建交易"}
          </button>
          <button type="button" className="btn" onClick={() => navigate("/transactions")}>
            取消
          </button>
        </div>
        {mutation.isError && <p className="error">创建失败: {(mutation.error as Error).message}</p>}
      </form>
    </div>
  );
}
